export const SECTIONS = ['DM', 'VALR', 'QADI', 'GK'] as const
export type Section = (typeof SECTIONS)[number]
export const isSection = (v: unknown): v is Section => (SECTIONS as readonly unknown[]).includes(v)

export type Passage = { id: string; section: Section; text: string }

export type Question = {
  id: string
  section: Section
  topic: string
  type?: string
  setId?: string // shared caselet / passage / DI set
  stem: string
  options: string[]
  answer: number // index into options
  explanation: string
}

export type Note = { topic: string; text: string }

export const MODES = ['drill', 'test', 'study'] as const
export type Mode = (typeof MODES)[number]

/** A drill or study set. answers: question id → option already picked (drill resume). */
export type PracticeData = {
  date?: string
  questions: Question[]
  passages: Passage[]
  answers: Record<string, number | null>
  note?: string
}

export type TestData = { section: Section; minutes: number; questions: Question[]; passages: Passage[] }
export type TestResult = { score: number; max: number; right: number; wrong: number; skipped: number }

export type Summary = { date: string; streak: number; doneToday: boolean; answeredToday: number; totalToday: number }

/** Per-topic totals. answered excludes skipped test questions; avgMs is per answered question. */
export type TopicRow = {
  section: Section
  topic: string
  questions: number
  answered: number
  right: number
  avgMs: number
  note: boolean
}

/** "section:DM" or "topic:ethics" → weight 0 (never) to 3 (lots). Missing = 1. */
export type Prefs = Record<string, number>
