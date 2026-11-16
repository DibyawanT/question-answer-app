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

/** XP per answer, bonus per finished daily drill, XP per level, and questions per round. */
export const XP = { right: 10, wrong: 2, drill: 20, level: 500 }
export const ROUND = 5

/** Section time in minutes: GK has its own 10 minutes; Part 1 time is split by question count. */
export const minutesFor = (s: Section) =>
  s === 'GK' ? MARKING.gkMinutes : Math.round((XAT[s].count * MARKING.part1Minutes) / MARKING.part1Questions)

/** results: true = right, false = wrong, null = not attempted. */
export function score(results: (boolean | null)[], section: Section) {
  const right = results.filter(r => r === true).length
  const wrong = results.filter(r => r === false).length
  const skipped = results.filter(r => r === null).length
  const raw =
    section === 'GK'
      ? right * MARKING.right
      : right * MARKING.right + wrong * MARKING.wrong + Math.max(0, skipped - MARKING.freeSkips) * MARKING.skip
  return { score: Math.round(raw * 100) / 100, max: results.length, right, wrong, skipped }
}
