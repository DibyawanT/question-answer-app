import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { minutesFor, score } from '../shared/scoring.ts'
import type { Question } from '../shared/types.ts'
import { type Attempt, buildDrill, doneDates, reminderDue, streak, today } from './drill.ts'
import { validateImport } from './importer.ts'

const read = (f: string) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'))
const seed = read('seed-dm.json')

describe('validateImport', () => {
  it('accepts the shipped banks in full', () => {
    for (const f of ['seed-dm.json', 'seed-mixed.json', 'bank-1-dm.json', 'bank-1-valr.json', 'bank-1-notes.json']) {
      const bank = read(f)
      const v = validateImport(bank, new Set())
      expect(v.rejected, f).toEqual([])
      expect(v.questions.length, f).toBe(bank.questions?.length ?? 0)
      expect(v.notes.length, f).toBe(bank.notes?.length ?? 0)
    }
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

  it('uses IST for the date', () => {
    expect(today(new Date('2026-11-14T20:00:00Z'))).toBe('2026-11-15')
  })
})

describe('streak', () => {
  const done = new Set(['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01'])
  it('counts back across a month boundary', () => expect(streak(done, '2026-12-01')).toBe(4))
  it('stays alive while today is not done yet', () => expect(streak(done, '2026-12-02')).toBe(4))
  it('resets after a missed day', () => {
    expect(streak(done, '2026-12-03')).toBe(0)
    expect(streak(new Set(), '2026-12-03')).toBe(0)
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
  it('splits Part 1 time by question count', () => {
    expect([minutesFor('VALR'), minutesFor('DM'), minutesFor('QADI'), minutesFor('GK')]).toEqual([59, 48, 63, 10])
  })
})
