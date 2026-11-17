import { XP } from '../shared/scoring.ts'
import type { Prefs, Question } from '../shared/types.ts'

/** Today's date in IST as YYYY-MM-DD. */
export const today = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
export const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10)

export const FREEZE = { every: 7, max: 2 }

/**
 * Days in a row with a finished drill, with grace: every 7th day in a row earns a freeze (max 2),
 * and a missed day spends a freeze instead of resetting. Today not done yet never counts as missed.
 * Replayed from the first finished day, so there is no stored streak to drift out of sync.
 */
export function streakInfo(done: Set<string>, date: string) {
  let streak = 0
  let freezes = 0
  let longest = 0
  for (let d = [...done].sort()[0]; d && d <= date; d = addDays(d, 1)) {
    if (done.has(d)) {
      if (++streak % FREEZE.every === 0) freezes = Math.min(FREEZE.max, freezes + 1)
    } else if (d === date) break
    else if (freezes) freezes--
    else streak = 0
    longest = Math.max(longest, streak)
  }
  return { streak, freezes, longest }
}

/** About one day in seven is a surprise golden day: double XP. Fixed per date, so it can't be re-rolled. */
export const golden = (date: string) => seeded(`gold${date}`)() < 1 / 7

/** Total XP: every answer counts (right more than wrong), doubled on golden days, plus a bonus per finished drill. */
export const xpFor = (history: Attempt[], done: Set<string>) =>
  history.reduce((n, a) => n + (a.correct ? XP.right : XP.wrong) * (golden(a.date) ? 2 : 1), 0) + done.size * XP.drill

/** Dates whose drill had every question answered. `answered` holds "date|questionId" keys. */
export const doneDates = (drills: { date: string; ids: string[] }[], answered: Set<string>) =>
  new Set(drills.filter(d => d.ids.every(id => answered.has(`${d.date}|${id}`))).map(d => d.date))

/**
 * Open mistakes: questions whose latest attempt (any mode, skips included) was not right.
 * Getting one right later closes it. Oldest miss first.
 */
export function openMistakes(attempts: { qid: string; correct: boolean }[]): string[] {
  const last = new Map<string, boolean>()
  for (const a of attempts) {
    last.delete(a.qid) // re-insert so Map order = order of latest attempt
    last.set(a.qid, a.correct)
  }
  return [...last].filter(([, correct]) => !correct).map(([qid]) => qid)
}

export const REMINDER_HOURS = [13, 21]

/** The reminder slot ("date|hour") to send now, or null. Fires once per slot, any minute of that IST hour. */
export function reminderDue(now: Date, alreadySent: (slot: string) => boolean, doneToday: boolean): string | null {
  if (doneToday) return null
  const hour = Number(now.toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }))
  if (!REMINDER_HOURS.includes(hour)) return null
  const slot = `${today(now)}|${hour}`
  return alreadySent(slot) ? null : slot
}

// Small seeded RNG so the same seed always gives the same pick.
function seeded(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Past answers in the order given; skipped questions are left out. */
export type Attempt = { qid: string; correct: boolean; date: string }

export const prefWeight = (p: Prefs, q: Question) => p[`topic:${q.topic}`] ?? p[`section:${q.section}`] ?? 1

type Options = { seed: string; date: string; history?: Attempt[]; prefs?: Prefs; size?: number; revision?: number }

/**
 * Picks a set of questions (daily drill, sectional test, study set):
 * 1. up to `revision` missed questions that are due again (see GAPS),
 * 2. one Decision Making caselet set,
 * 3. the rest: unseen before seen, then weighted by your preference × how weak you are in the topic.
 * Questions sharing a setId stay together in bank order. Weight 0 removes a section or topic.
 */
// Spaced repetition: a missed question returns 2 days later, then 7 days after you get it right.
// Two rights in a row retire it; another miss starts it over.
const GAPS = [2, 7]

export function buildDrill(questions: Question[], o: Options): Question[] {
  const { history = [], prefs = {}, size = 20, revision = 5 } = o
  const rand = seeded(o.seed)
  const byId = new Map(questions.map(q => [q.id, q]))
  const last = new Map<string, Attempt>()
  const rights = new Map<string, number>() // right answers in a row since the last miss; only for questions ever missed
  const topics = new Map<string, { right: number; total: number }>()
  for (const a of history) {
    last.set(a.qid, a)
    if (!a.correct) rights.set(a.qid, 0)
    else if (rights.has(a.qid)) rights.set(a.qid, rights.get(a.qid)! + 1)
    const t = byId.get(a.qid)?.topic
    if (t === undefined) continue
    const s = topics.get(t) ?? { right: 0, total: 0 }
    s.total++
    if (a.correct) s.right++
    topics.set(t, s)
  }

  const pool = questions.filter(q => prefWeight(prefs, q) > 0)
  const due = pool
    .filter(q => {
      const gap = GAPS[rights.get(q.id) ?? GAPS.length]
      return gap !== undefined && last.get(q.id)!.date <= addDays(o.date, -gap)
    })
    .sort((a, b) => last.get(a.id)!.date.localeCompare(last.get(b.id)!.date))
    .slice(0, revision)
  const dueIds = new Set(due.map(q => q.id))

  const groups = new Map<string, Question[]>()
  for (const q of pool) {
    if (dueIds.has(q.id)) continue
    const key = q.setId ?? q.id
    groups.set(key, [...(groups.get(key) ?? []), q])
  }

  const weakness = (topic: string) => {
    const s = topics.get(topic)
    return s ? 1 - s.right / s.total : 0.5
  }
  // Weighted shuffle (Efraimidis–Spirakis): rand^(1/w), bigger w drifts to the front. Unseen get +1 so they lead.
  const rank = (g: Question[]) =>
    (g.some(q => last.has(q.id)) ? 0 : 1) + rand() ** (1 / (prefWeight(prefs, g[0]) * (0.5 + weakness(g[0].topic))))
  const ordered = [...groups.values()]
    .map(g => ({ g, k: rank(g) }))
    .sort((a, b) => b.k - a.k)
    .map(x => x.g)
  const caselet = ordered.find(g => g[0].section === 'DM' && g[0].setId)

  const out: Question[] = []
  for (const g of [...(caselet ? [caselet] : []), ...due.map(q => [q]), ...ordered.filter(g => g !== caselet)])
    if (out.length + g.length <= size || out.length === 0) out.push(...g)
  return out
}
