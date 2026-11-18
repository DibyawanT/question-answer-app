import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { minutesFor, score, scorePaper, smoothed, XP } from '../shared/scoring.ts'
import type { Question } from '../shared/types.ts'
import { addDays, type Attempt, buildDrill, doneDates, golden, openMistakes, reminderDue, streakInfo, today, xpFor } from './drill.ts'
import { validateImport } from './importer.ts'

const read = (f: string) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'))
const seed = read('seed-dm.json')

describe('validateImport', () => {
  it('accepts every shipped bank in full, with no id shared across files', () => {
    const owner = new Map<string, string>()
    for (const f of readdirSync(new URL('../data/', import.meta.url)).filter(f => f.endsWith('.json'))) {
      const bank = read(f)
      const v = validateImport(bank, new Set())
      expect(v.rejected, f).toEqual([])
      expect(v.questions.length, f).toBe(bank.questions?.length ?? 0)
      expect(v.notes.length, f).toBe(bank.notes?.length ?? 0)
      for (const id of [...v.questions, ...v.passages].map(x => x.id)) {
        expect(owner.get(id), `${id} in ${f}`).toBeUndefined()
        owner.set(id, f)
      }
    }
  })

  it('ships no question twice under different ids (same stem; generic odd-sentence prompts excepted)', () => {
    const norm = (s: string) => s.toLowerCase().replace(/\$|\\[a-z]+|[^a-z0-9]/g, '')
    const owner = new Map<string, string>()
    const copies: string[] = []
    for (const f of readdirSync(new URL('../data/', import.meta.url)).filter(f => f.endsWith('.json')))
      for (const q of (read(f).questions ?? []) as Question[]) {
        if (q.topic === 'odd-sentence') continue
        const k = norm(q.stem)
        if (owner.has(k)) copies.push(`${owner.get(k)} = ${q.id}`)
        owner.set(k, q.id)
      }
    expect(copies).toEqual([])
  })

  it('rejects bad items with a reason and keeps the good ones', () => {
    const good = seed.questions[7]
    const v = validateImport(
      {
        questions: [
          good,
          { ...good, id: 'x1', answer: 5 },
          { ...good, id: 'x2', setId: 'nope' },
          { ...good, id: 'x3', section: 'CAT' },
          { ...good, id: 'x4', options: ['only one'] },
          good,
        ],
      },
      new Set(),
    )
    expect(v.questions.map(q => q.id)).toEqual([good.id])
    expect(v.rejected.map(r => r.reason)).toEqual([
      'answer out of range',
      'unknown setId nope',
      'bad section CAT',
      'options must be 2+ non-empty strings',
      'duplicate id in file',
    ])
  })

  it('accepts a setId that is already in the database', () => {
    const q = { ...seed.questions[0], setId: 'old-passage' }
    expect(validateImport({ questions: [q] }, new Set(['old-passage'])).rejected).toEqual([])
  })

  it('survives garbage input', () => {
    expect(validateImport(null, new Set()).questions).toEqual([])
    expect(validateImport({ questions: 'x' }, new Set()).questions).toEqual([])
  })
})

describe('buildDrill', () => {
  const bank: Question[] = [
    ...validateImport(seed, new Set()).questions,
    ...validateImport(read('seed-mixed.json'), new Set()).questions,
  ]
  const day = '2026-11-15'
  const drill = (o: Partial<Parameters<typeof buildDrill>[1]> = {}) => buildDrill(bank, { seed: day, date: day, ...o })

  it('is the same all day and changes between days', () => {
    expect(drill()).toEqual(drill())
    const ids = (d: string) => buildDrill(bank, { seed: d, date: d }).map(q => q.id).join()
    expect(new Set(['2026-11-15', '2026-11-16', '2026-11-17'].map(ids)).size).toBeGreaterThan(1)
  })

  it('once a topic runs out of unseen questions, serves the least recently seen, not the set just finished', () => {
    const topic = Array.from({ length: 13 }, (_, i) => ({ ...bank[0], id: `r${i}`, setId: undefined, topic: 'r' }))
    const seen = (ids: string[], date: string) => ids.map(qid => ({ qid, correct: true, date }))
    const old = seen(['r0', 'r1', 'r2', 'r3', 'r4'], '2026-11-01')
    const justNow = ['r5', 'r6', 'r7', 'r8', 'r9']
    for (let s = 0; s < 50; s++) {
      const out = buildDrill(topic, { seed: `${s}`, date: day, size: 5, revision: 2, history: [...old, ...seen(justNow, day)] }).map(q => q.id)
      expect(out.slice(0, 3).sort()).toEqual(['r10', 'r11', 'r12']) // unseen still lead
      expect(out.filter(id => justNow.includes(id))).toEqual([])
    }
  })

  it('a due question brings the rest of its caselet, in bank order', () => {
    const q = (id: string, setId?: string) => ({ ...bank[0], id, setId, section: 'DM' as const, topic: 'c' })
    const pool = [q('c1', 'S'), q('c2', 'S'), q('c3', 'S'), ...Array.from({ length: 20 }, (_, i) => q(`o${i}`))]
    const out = buildDrill(pool, { seed: 'z', date: day, history: [{ qid: 'c2', correct: false, date: '2026-11-10' }] }).map(x => x.id)
    expect(out.slice(0, 3)).toEqual(['c1', 'c2', 'c3'])
    expect(out.filter(id => id.startsWith('c'))).toHaveLength(3)
  })

  it('a question skipped in a test counts as seen, not as new', () => {
    const pool = Array.from({ length: 30 }, (_, i) => ({ ...bank[0], id: `t${i}`, setId: undefined, topic: 't' }))
    const t1 = buildDrill(pool, { seed: 'a', date: day, size: 10, revision: 0 }).map(x => x.id)
    const history = t1.map((qid, i) => ({ qid, correct: false, date: day, ...(i >= 5 ? { skipped: true } : {}) }))
    const t2 = buildDrill(pool, { seed: 'b', date: day, size: 10, revision: 0, history }).map(x => x.id)
    expect(t2.filter(id => t1.includes(id))).toEqual([])
    // A skip is not a miss: it never becomes due for revision.
    const later = buildDrill(pool, { seed: 'c', date: '2026-11-25', size: 30, revision: 30, history: history.slice(5) })
    expect(later.slice(0, 5).map(x => x.id).some(id => t1.includes(id))).toBe(false)
  })

  it('starts with a DM caselet and keeps each set together in order', () => {
    const d = drill()
    expect(d.length).toBeLessThanOrEqual(20)
    expect(d[0].section === 'DM' && d[0].setId).toBeTruthy()
    for (const set of new Set(d.flatMap(q => (q.setId ? [q.setId] : [])))) {
      const at = d.flatMap((q, i) => (q.setId === set ? [i] : []))
      expect(at).toEqual(at.map((_, k) => at[0] + k))
    }
  })

  it('drops a section or topic set to weight 0', () => {
    expect(drill({ prefs: { 'section:VALR': 0 } }).some(q => q.section === 'VALR')).toBe(false)
    expect(drill({ prefs: { 'topic:ethics': 0 } }).some(q => q.topic === 'ethics')).toBe(false)
  })

  it('gives more of a topic with a higher weight', () => {
    const count = (prefs: Record<string, number>) => {
      let n = 0
      for (let k = 1; k <= 30; k++) n += buildDrill(bank, { seed: `s${k}`, date: day, prefs, size: 8 }).filter(q => q.section === 'GK').length
      return n
    }
    expect(count({ 'section:GK': 3 })).toBeGreaterThan(count({}))
  })

  it('serves unseen questions before seen ones', () => {
    const seen = bank.filter(q => q.section === 'GK').map(q => q.id)
    const history: Attempt[] = seen.map(qid => ({ qid, correct: true, date: '2026-11-01' }))
    expect(drill({ history, size: 10 }).some(q => seen.includes(q.id))).toBe(false)
  })

  it('brings back wrong answers after 2 days, not before, and not once answered right', () => {
    const [a, b, c] = bank.filter(q => !q.setId).map(q => q.id)
    const history: Attempt[] = [
      { qid: a, correct: false, date: '2026-11-13' }, // 2 days ago → due
      { qid: b, correct: false, date: '2026-11-14' }, // yesterday → not yet
      { qid: c, correct: false, date: '2026-11-10' },
      { qid: c, correct: true, date: '2026-11-12' }, // fixed since
    ]
    const ids = drill({ history }).map(q => q.id)
    expect(ids).toContain(a)
    expect(ids).not.toContain(b)
    expect(ids).not.toContain(c)
    expect(drill({ history, revision: 0 }).map(q => q.id)).not.toContain(a)
  })

  it('brings a fixed question back once more after 7 days, then retires it', () => {
    const c = bank.find(q => !q.setId)!.id
    const history: Attempt[] = [
      { qid: c, correct: false, date: '2026-11-01' },
      { qid: c, correct: true, date: '2026-11-03' },
    ]
    const ids = (date: string, h = history) => buildDrill(bank, { seed: date, date, history: h }).map(q => q.id)
    expect(ids('2026-11-09')).not.toContain(c) // 6 days: not yet
    expect(ids('2026-11-10')).toContain(c) // 7 days: due
    expect(ids('2026-12-10', [...history, { qid: c, correct: true, date: '2026-11-10' }])).not.toContain(c)
  })

  it('uses IST for the date', () => {
    expect(today(new Date('2026-11-14T20:00:00Z'))).toBe('2026-11-15')
  })
})

describe('streak', () => {
  const streak = (done: Set<string>, date: string) => streakInfo(done, date).streak
  const done = new Set(['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01'])
  it('counts back across a month boundary', () => expect(streak(done, '2026-12-01')).toBe(4))
  it('stays alive while today is not done yet', () => expect(streak(done, '2026-12-02')).toBe(4))
  it('resets after a missed day', () => {
    expect(streak(done, '2026-12-03')).toBe(0)
    expect(streak(new Set(), '2026-12-03')).toBe(0)
  })

  it('earns a freeze every 7 days and spends it on a missed day', () => {
    const days = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, k) => addDays('2026-11-01', from + k))
    const week = new Set(days(0, 6)) // Nov 1–7
    expect(streakInfo(week, '2026-11-07')).toEqual({ streak: 7, freezes: 1, longest: 7 })
    // Nov 8 missed: the freeze covers it. Nov 9 not done yet.
    expect(streakInfo(week, '2026-11-09')).toEqual({ streak: 7, freezes: 0, longest: 7 })
    // Nov 9 done: the streak carries on.
    expect(streakInfo(new Set([...week, '2026-11-09']), '2026-11-09').streak).toBe(8)
    // Nov 8 and 9 both missed with one freeze: reset, but the longest is remembered.
    expect(streakInfo(week, '2026-11-10')).toEqual({ streak: 0, freezes: 0, longest: 7 })
    // Never more than 2 freezes banked.
    expect(streakInfo(new Set(days(0, 27)), '2026-11-28').freezes).toBe(2)
  })
})

describe('xp', () => {
  const dates = Array.from({ length: 700 }, (_, k) => addDays('2026-01-01', k))
  const plain = dates.find(d => !golden(d))!
  const gold = dates.find(golden)!

  it('makes roughly one day in seven golden, the same every time', () => {
    const n = dates.filter(golden).length
    expect(n).toBeGreaterThan(50)
    expect(n).toBeLessThan(150)
    expect(golden(gold)).toBe(true)
  })

  it('counts right more than wrong, doubles on golden days, adds a bonus per finished drill', () => {
    const answers = (date: string): Attempt[] => [
      { qid: 'a', correct: true, date },
      { qid: 'b', correct: false, date },
    ]
    expect(xpFor(answers(plain), new Set())).toBe(XP.right + XP.wrong)
    expect(xpFor(answers(gold), new Set())).toBe(2 * (XP.right + XP.wrong))
    expect(xpFor([], new Set([plain, gold]))).toBe(2 * XP.drill)
  })
})

describe('doneDates', () => {
  it('needs every question of that day answered on that day', () => {
    const drills = [
      { date: '2026-11-15', ids: ['a', 'b'] },
      { date: '2026-11-16', ids: ['c', 'd'] },
    ]
    const answered = new Set(['2026-11-15|a', '2026-11-15|b', '2026-11-16|c', '2026-11-17|d'])
    expect([...doneDates(drills, answered)]).toEqual(['2026-11-15'])
  })
})

describe('openMistakes', () => {
  it('keeps questions whose latest attempt was wrong, oldest miss first; a right answer closes one', () => {
    const a = (qid: string, correct: boolean) => ({ qid, correct })
    expect(openMistakes([a('x', false), a('y', false), a('z', true), a('x', true), a('z', false), a('y', false)])).toEqual(['z', 'y'])
  })
})

describe('smoothed', () => {
  it('ranks 0 of 1 (raw 0%) as less weak than 2 of 10 (raw 20%)', () => {
    expect(smoothed(0, 1)).toBeGreaterThan(smoothed(2, 10))
    expect(smoothed(0, 0)).toBe(0.5)
    expect(smoothed(0, 1)).toBeGreaterThan(smoothed(0, 10))
  })
})

describe('reminderDue', () => {
  const at = (ist: string) => new Date(`${ist}+05:30`)
  const none = () => false
  it('fires at 1 pm and 9 pm IST only', () => {
    expect(reminderDue(at('2026-11-15T13:00:00'), none, false)).toBe('2026-11-15|13')
    expect(reminderDue(at('2026-11-15T21:40:00'), none, false)).toBe('2026-11-15|21')
    expect(reminderDue(at('2026-11-15T12:59:00'), none, false)).toBeNull()
    expect(reminderDue(at('2026-11-15T22:00:00'), none, false)).toBeNull()
  })
  it('skips when done or already sent', () => {
    expect(reminderDue(at('2026-11-15T13:05:00'), none, true)).toBeNull()
    expect(reminderDue(at('2026-11-15T13:05:00'), s => s === '2026-11-15|13', false)).toBeNull()
  })
})

describe('score', () => {
  const r = (right: number, wrong: number, skipped: number) => [
    ...Array<boolean>(right).fill(true),
    ...Array<boolean>(wrong).fill(false),
    ...Array<null>(skipped).fill(null),
  ]
  it('applies −0.25 per wrong and −0.10 per skip beyond 8', () => {
    expect(score(r(10, 4, 12), 'VALR')).toEqual({ score: 8.6, max: 26, right: 10, wrong: 4, skipped: 12 })
    expect(score(r(10, 4, 8), 'DM').score).toBe(9)
  })
  it('has no negatives in GK', () => {
    expect(score(r(5, 5, 10), 'GK').score).toBe(5)
  })
  it('marks a mixed weak-spot paper: free skips scale with Part 1 length, GK unpenalised', () => {
    const items = [
      ...r(10, 4, 6).map(result => ({ section: 'DM' as const, result })),
      ...r(2, 2, 1).map(result => ({ section: 'GK' as const, result })),
    ]
    // Part 1: 20 questions → 2 free skips; 10 − 4×0.25 − 4×0.10 = 8.6. GK: 2. Total 10.6.
    expect(scorePaper(items)).toEqual({ score: 10.6, max: 25, right: 12, wrong: 6, skipped: 7 })
  })
  it('splits Part 1 time by question count', () => {
    expect([minutesFor('VALR'), minutesFor('DM'), minutesFor('QADI'), minutesFor('GK')]).toEqual([59, 48, 63, 10])
  })
})

describe('mandala', () => {
  it('has 8 children at every level down to 512 concepts, and green rolls up', async () => {
    const { ROOT, byId, doneCount, passMark } = await import('../shared/mandala.ts')
    const walk = (n: typeof ROOT): number => (n.children.length ? (expect(n.children, n.code).toHaveLength(8), n.children.reduce((a, c) => a + walk(c), 0)) : 1)
    expect(walk(ROOT)).toBe(512)
    expect(ROOT.leaves).toBe(512)
    const topic = byId.get('4-1')!
    const done = Object.fromEntries(topic.children.map(c => [c.id, { at: '2026-11-18', score: '5/5' }]))
    expect(doneCount(topic, done)).toBe(topic.leaves)
    expect(doneCount(byId.get('4')!, done)).toBe(8)
    expect([passMark(5), passMark(4), passMark(3)]).toEqual([4, 4, 3])
  })
})

describe('mergeCopies', () => {
  it('lists only copies gone from data/ and kept questions still shipped', async () => {
    process.env.DB_PATH = ':memory:'
    const { COPIES } = await import('./db.ts')
    const shipped = new Set(
      readdirSync(new URL('../data/', import.meta.url)).filter(f => f.endsWith('.json')).flatMap(f => (read(f).questions ?? []).map((q: Question) => q.id)),
    )
    for (const [copy, keep] of COPIES) expect([shipped.has(copy), shipped.has(keep)], copy).toEqual([false, true])
  })

  it('moves attempts and drill slots to the kept question, then deletes the copy', async () => {
    process.env.DB_PATH = ':memory:'
    const { db, importBank, history, drillFor, COPIES } = await import('./db.ts')
    const [copy, keep] = COPIES[0]
    const base = read('seed-mixed.json').questions[0]
    const r = importBank({ questions: [{ ...base, id: copy, setId: undefined }, { ...base, id: keep, setId: undefined, stem: 'kept' }] })
    expect(r.added).toBe(2) // merge ran right after this upload
    expect(db.prepare('SELECT id FROM questions WHERE id IN (?, ?)').all(copy, keep).map(x => x.id)).toEqual([keep])

    // Copy loaded from an older upload, with history: put it back by hand and merge again.
    db.prepare('INSERT INTO questions (id, section, topic, data) VALUES (?, ?, ?, ?)').run(copy, base.section, base.topic, JSON.stringify({ ...base, id: copy }))
    db.prepare("INSERT INTO attempts (qid, picked, correct, ms, date, mode) VALUES (?, 0, 1, 1, '2026-11-01', 'drill')").run(copy)
    db.prepare('INSERT INTO drills (date, ids) VALUES (?, ?)').run('2026-11-01', JSON.stringify([copy, keep]))
    const { mergeCopies } = await import('./db.ts')
    mergeCopies()
    expect(history().map(a => a.qid)).toEqual([keep])
    expect(drillFor('2026-11-01').map(q => q.id)).toEqual([keep])
  })
})
