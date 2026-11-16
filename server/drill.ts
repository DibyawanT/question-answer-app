import type { Prefs, Question } from '../shared/types.ts'

/** Today's date in IST as YYYY-MM-DD. */
export const today = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
export const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10)

/** Days in a row with a finished drill. Today not done yet doesn't break it until the day is over. */
export function streak(done: Set<string>, date: string) {
  let d = done.has(date) ? date : addDays(date, -1)
  let n = 0
  for (; done.has(d); d = addDays(d, -1)) n++
  return n
}

/** Dates whose drill had every question answered. `answered` holds "date|questionId" keys. */
export const doneDates = (drills: { date: string; ids: string[] }[], answered: Set<string>) =>
  new Set(drills.filter(d => d.ids.every(id => answered.has(`${d.date}|${id}`))).map(d => d.date))

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
 * 1. up to `revision` questions last answered wrong 2+ days before `date`,
 * 2. one Decision Making caselet set,
 * 3. the rest: unseen before seen, then weighted by your preference × how weak you are in the topic.
 * Questions sharing a setId stay together in bank order. Weight 0 removes a section or topic.
 */
// ponytail: fixed 2-day revision gap; real spaced repetition only if this proves too crude.
export function buildDrill(questions: Question[], o: Options): Question[] {
  const { history = [], prefs = {}, size = 20, revision = 5 } = o
  const rand = seeded(o.seed)
  const byId = new Map(questions.map(q => [q.id, q]))
  const last = new Map<string, Attempt>()
  const topics = new Map<string, { right: number; total: number }>()
  for (const a of history) {
    last.set(a.qid, a)
    const t = byId.get(a.qid)?.topic
    if (t === undefined) continue
    const s = topics.get(t) ?? { right: 0, total: 0 }
    s.total++
    if (a.correct) s.right++
    topics.set(t, s)
  }

  const pool = questions.filter(q => prefWeight(prefs, q) > 0)
  const cutoff = addDays(o.date, -2)
  const due = pool
    .filter(q => {
      const a = last.get(q.id)
      return a && !a.correct && a.date <= cutoff
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
