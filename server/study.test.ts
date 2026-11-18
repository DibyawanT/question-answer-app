import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ROOT } from '../shared/mandala.ts'
import type { StudyTopic } from '../shared/types.ts'
import { initSocratic, type Rating, socratic, type SocraticAction, type SocraticState, tally } from '../web/src/socratic.ts'

const run = (actions: SocraticAction[], s: SocraticState = initSocratic(3)) => actions.reduce(socratic, s)
const rate = (rating: Rating): SocraticAction[] => [{ type: 'REVEAL' }, { type: 'RATE', rating }]

describe('socratic reducer', () => {
  it('reveals without a hunch', () => {
    const s = run([{ type: 'REVEAL' }])
    expect(s.phase).toBe('COMPARING')
    expect(s.hunch).toBe('')
  })

  it('keeps a typed hunch and ignores rating before reveal', () => {
    const s = run([{ type: 'TYPE', text: ' 20% ' }, { type: 'RATE', rating: 3 }])
    expect(s.phase).toBe('PROMPTING')
    expect(run([{ type: 'REVEAL' }], s).hunch).toBe('20%')
  })

  it('hint moves to HINT_REVEALED and counts once per prompt', () => {
    const s = run([{ type: 'HINT' }, { type: 'HINT' }])
    expect(s.phase).toBe('HINT_REVEALED')
    expect(s.hints).toBe(1)
    expect(s.hintSteps).toEqual([0])
    const after = run(rate(2), s)
    expect(after.completed[0].usedHint).toBe(true)
    expect(after.phase).toBe('PROMPTING')
  })

  it('Missed requeues a step once, then moves on', () => {
    let s = run(rate(1))
    expect(s.queue).toEqual([0, 1, 2, 0])
    s = run([...rate(3), ...rate(3)], s) // steps 1, 2
    expect(s.queue[s.pos]).toBe(0)
    s = run(rate(1), s) // second miss of step 0
    expect(s.queue).toEqual([0, 1, 2, 0])
    expect(s.completed.at(-1)).toMatchObject({ step: 0, isRetry: true, rating: 1 })
    expect(s.phase).toBe('SESSION_COMPLETE')
  })

  it('last rating completes the session with a correct tally', () => {
    const s = run([...rate(3), { type: 'HINT' }, ...rate(2), ...rate(1), ...rate(3)])
    expect(s.phase).toBe('SESSION_COMPLETE')
    expect(s.completed.map(r => r.step)).toEqual([0, 1, 2, 2])
    expect(tally(s.completed)).toEqual({ nailed: 2, close: 1, missed: 1 })
    expect(s.hints).toBe(1)
    expect(run([{ type: 'RESET', steps: 3 }], s)).toEqual(initSocratic(3))
  })
})

describe('study session content', () => {
  const dir = new URL('../shared/study/', import.meta.url)
  const all: StudyTopic[] = readdirSync(dir)
    .filter(f => /^s\d+\.json$/.test(f))
    .flatMap(f => JSON.parse(readFileSync(new URL(f, dir), 'utf8')))
  const topics = ROOT.children.flatMap(s => s.children)

  it('covers all 64 mandala topics exactly once, with the right titles', () => {
    expect(topics).toHaveLength(64)
    for (const n of topics) {
      const hits = all.filter(t => t.topicId === n.id)
      expect(hits, n.id).toHaveLength(1)
      expect(hits[0].title, n.id).toBe(n.name)
    }
  })

  it('has the right shape and balanced $ maths', () => {
    for (const t of all) {
      const at = t.topicId
      expect(t.simplified.coreIntuition.trim(), at).not.toBe('')
      expect(t.simplified.keyPoints.length, at).toBeGreaterThanOrEqual(3)
      expect(t.simplified.keyPoints.length, at).toBeLessThanOrEqual(6)
      expect(t.simplified.analogy.trim(), at).not.toBe('')
      expect(t.flashcards, at).toHaveLength(8)
      for (const c of t.flashcards) expect(c.front.trim() && c.back.trim(), at).toBeTruthy()
      expect(t.socratic, at).toHaveLength(3)
      for (const q of t.socratic) expect(q.question.trim() && q.hint.trim() && q.reveal.trim(), at).toBeTruthy()
      const strings = [
        t.title,
        t.simplified.coreIntuition,
        t.simplified.analogy,
        ...t.simplified.keyPoints,
        ...t.flashcards.flatMap(c => [c.front, c.back]),
        ...t.socratic.flatMap(q => [q.question, q.hint, q.reveal]),
      ]
      for (const s of strings) expect((s.match(/\$/g) ?? []).length % 2, `${at}: ${s}`).toBe(0)
    }
  })
})
