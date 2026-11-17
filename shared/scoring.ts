import type { Section } from './types.ts'

// XAT 2027 pattern as reported by coaching sites (Careers360, Cracku, MBAUniverse); the official
// bulletin wasn't reachable when this was written. Change the numbers here if XLRI's differ.
export const XAT: Record<Section, { name: string; count: number }> = {
  VALR: { name: 'Verbal & Logical Ability', count: 26 },
  DM: { name: 'Decision Making', count: 21 },
  QADI: { name: 'Quant & Data Interpretation', count: 28 },
  GK: { name: 'General Knowledge', count: 20 },
}
export const MARKING = { right: 1, wrong: -0.25, freeSkips: 8, skip: -0.1, part1Minutes: 170, part1Questions: 75, gkMinutes: 10 }

/** Real exam pace for a section, in seconds per question. */
export const paceFor = (s: Section) => Math.round((minutesFor(s) * 60) / XAT[s].count)

/** Accuracy with one imaginary right and one wrong added, so 1 of 1 doesn't read as 100% (or 0%). Unseen = 0.5. */
export const smoothed = (right: number, answered: number) => (right + 1) / (answered + 2)

/** XP per answer, bonus per finished daily drill, XP per level, and questions per round. */
export const XP = { right: 10, wrong: 2, drill: 20, level: 500 }
export const ROUND = 5

/** Section time in minutes: GK has its own 10 minutes; Part 1 time is split by question count. */
export const minutesFor = (s: Section) =>
  s === 'GK' ? MARKING.gkMinutes : Math.round((XAT[s].count * MARKING.part1Minutes) / MARKING.part1Questions)

/** results: true = right, false = wrong, null = not attempted. */
export function score(results: (boolean | null)[], section: Section, freeSkips: number = MARKING.freeSkips) {
  const right = results.filter(r => r === true).length
  const wrong = results.filter(r => r === false).length
  const skipped = results.filter(r => r === null).length
  const raw =
    section === 'GK'
      ? right * MARKING.right
      : right * MARKING.right + wrong * MARKING.wrong + Math.max(0, skipped - freeSkips) * MARKING.skip
  return { score: Math.round(raw * 100) / 100, max: results.length, right, wrong, skipped }
}

/**
 * Weak-spot paper: a mixed paper built from your weakest topics and open mistakes.
 * Unlocks after `unlock` answered questions; `mistakes` of its `size` questions are open mistakes,
 * the rest come from your `topics` weakest topics.
 */
export const PAPER = { unlock: 100, size: 25, mistakes: 10, topics: 5 }
export const WEAK = 'WEAK'
export type PaperKind = Section | typeof WEAK
export const paperName = (k: PaperKind) => (k === WEAK ? 'Weak-spot paper' : XAT[k].name)

/** Free skips scale with Part 1 length: 8 per 75 questions. */
export const freeSkipsFor = (part1Questions: number) => Math.round((part1Questions * MARKING.freeSkips) / MARKING.part1Questions)

/** Marks a mixed paper: GK has no negatives; Part 1 questions share the scaled free-skip allowance. */
export function scorePaper(items: { section: Section; result: boolean | null }[]) {
  const part1 = items.filter(i => i.section !== 'GK').map(i => i.result)
  const a = score(part1, 'VALR', freeSkipsFor(part1.length))
  const b = score(items.filter(i => i.section === 'GK').map(i => i.result), 'GK')
  return {
    score: Math.round((a.score + b.score) * 100) / 100,
    max: items.length,
    right: a.right + b.right,
    wrong: a.wrong + b.wrong,
    skipped: a.skipped + b.skipped,
  }
}
