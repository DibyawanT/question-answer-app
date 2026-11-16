import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { minutesFor, score, XAT } from '../shared/scoring.ts'
import { isSection, MODES, type Passage, type Prefs, type Question, type Summary, type TopicRow } from '../shared/types.ts'
import { addDays, buildDrill, doneDates, golden, streakInfo, today, xpFor, type Attempt } from './drill.ts'
import { validateImport } from './importer.ts'

export const db = new DatabaseSync(process.env.DB_PATH ?? 'app.db')
db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY, section TEXT NOT NULL, topic TEXT NOT NULL, set_id TEXT, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS passages (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS notes (topic TEXT PRIMARY KEY, text TEXT NOT NULL);
  -- The question ids picked for each day's drill, so the drill stays fixed even if the bank changes mid-day.
  CREATE TABLE IF NOT EXISTS drills (date TEXT PRIMARY KEY, ids TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY, qid TEXT NOT NULL, picked INTEGER, correct INTEGER NOT NULL, ms INTEGER NOT NULL,
    date TEXT NOT NULL, mode TEXT NOT NULL, at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE INDEX IF NOT EXISTS attempts_date_mode ON attempts (date, mode);
  CREATE INDEX IF NOT EXISTS attempts_qid ON attempts (qid);
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY, qid TEXT NOT NULL, reason TEXT NOT NULL, at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS prefs (key TEXT PRIMARY KEY, weight REAL NOT NULL);
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS reminder_log (slot TEXT PRIMARY KEY, at TEXT NOT NULL DEFAULT (datetime('now')));
`)

/** Runs fn in a transaction; rolls back if it throws. */
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN')
  try {
    const r = fn()
    db.exec('COMMIT')
    return r
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

const json = (v: unknown) => JSON.parse(String(v))
const putQuestion = db.prepare('INSERT OR REPLACE INTO questions (id, section, topic, set_id, data) VALUES (?, ?, ?, ?, ?)')
const putPassage = db.prepare('INSERT OR REPLACE INTO passages (id, data) VALUES (?, ?)')
const putNote = db.prepare('INSERT OR REPLACE INTO notes (topic, text) VALUES (?, ?)')
const hasQuestion = db.prepare('SELECT 1 FROM questions WHERE id = ?')
const getQuestion = db.prepare('SELECT data FROM questions WHERE id = ?')
const getPassage = db.prepare('SELECT data FROM passages WHERE id = ?')
const getDrill = db.prepare('SELECT ids FROM drills WHERE date = ?')
const putDrill = db.prepare('INSERT INTO drills (date, ids) VALUES (?, ?)')
const putAttempt = db.prepare('INSERT INTO attempts (qid, picked, correct, ms, date, mode) VALUES (?, ?, ?, ?, ?, ?)')

export function importBank(body: unknown) {
  const known = new Set(db.prepare('SELECT id FROM passages').all().map(r => String(r.id)))
  const v = validateImport(body, known)
  let added = 0
  let updated = 0
  tx(() => {
    for (const p of v.passages) putPassage.run(p.id, JSON.stringify(p))
    for (const q of v.questions) {
      hasQuestion.get(q.id) ? updated++ : added++
      putQuestion.run(q.id, q.section, q.topic, q.setId ?? null, JSON.stringify(q))
    }
    for (const n of v.notes) putNote.run(n.topic, n.text)
  })
  return { added, updated, passages: v.passages.length, notes: v.notes.length, rejected: v.rejected }
}

const question = (id: string): Question | undefined => {
  const row = getQuestion.get(id)
  return row && json(row.data)
}

export const allQuestions = (): Question[] => db.prepare('SELECT data FROM questions ORDER BY id').all().map(r => json(r.data))

export function passagesFor(questions: Question[]): Passage[] {
  const ids = [...new Set(questions.flatMap(q => (q.setId ? [q.setId] : [])))]
  return ids.flatMap(id => {
    const row = getPassage.get(id)
    return row ? [json(row.data)] : []
  })
}

/** Every answered (not skipped) attempt, oldest first. */
export const history = (): Attempt[] =>
  db
    .prepare('SELECT qid, correct, date FROM attempts WHERE picked IS NOT NULL ORDER BY id')
    .all()
    .map(r => ({ qid: String(r.qid), correct: Number(r.correct) === 1, date: String(r.date) }))

export const getPrefs = (): Prefs =>
  Object.fromEntries(db.prepare('SELECT key, weight FROM prefs').all().map(r => [String(r.key), Number(r.weight)]))

export function setPrefs(b: unknown) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: 'expected an object of weights' }
  const entries = Object.entries(b)
  if (!entries.every(([k, v]) => /^(section|topic):.+/.test(k) && typeof v === 'number' && v >= 0 && v <= 3))
    return { error: 'keys must be section:X or topic:X with weights from 0 to 3' }
  const put = db.prepare('INSERT INTO prefs (key, weight) VALUES (?, ?)')
  tx(() => {
    db.exec('DELETE FROM prefs')
    for (const [k, v] of entries) put.run(k, v as number)
  })
  return { ok: true }
}

/** The drill for a date: picked once, then fixed for the rest of that day. */
export function drillFor(date: string): Question[] {
  const row = getDrill.get(date)
  if (row) return (json(row.ids) as string[]).flatMap(id => question(id) ?? [])
  const questions = buildDrill(allQuestions(), { seed: date, date, history: history(), prefs: getPrefs() })
  if (questions.length) putDrill.run(date, JSON.stringify(questions.map(q => q.id)))
  return questions
}

export const drillAnswers = (date: string): Record<string, number | null> =>
  Object.fromEntries(
    db
      .prepare("SELECT qid, picked FROM attempts WHERE date = ? AND mode = 'drill' ORDER BY id")
      .all(date)
      .map(r => [String(r.qid), r.picked === null ? null : Number(r.picked)]),
  )

/** Saves one answer (picked null = not attempted). Correctness is decided here, never trusted from the client. */
export function recordAttempt(b: any): { error: string } | { correct: boolean; answer: number } {
  const q = typeof b?.qid === 'string' ? question(b.qid) : undefined
  if (!q) return { error: 'unknown question' }
  const picked = b.picked === null ? null : Number.isInteger(b.picked) && b.picked >= 0 && b.picked < q.options.length ? b.picked : undefined
  if (picked === undefined) return { error: 'picked must be an option index or null' }
  if (!MODES.includes(b.mode)) return { error: `mode must be one of ${MODES.join(', ')}` }
  const ms = Math.min(Math.max(0, Math.round(Number(b.ms) || 0)), 3_600_000)
  // A drill started before midnight still counts for the day it belongs to.
  const date = b.mode === 'drill' && typeof b.date === 'string' && getDrill.get(b.date) ? b.date : today()
  const correct = picked === q.answer
  putAttempt.run(q.id, picked, correct ? 1 : 0, ms, date, b.mode)
  return { correct, answer: q.answer }
}

export function reportQuestion(b: any) {
  if (typeof b?.qid !== 'string' || !question(b.qid)) return { error: 'unknown question' }
  const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 1000) : ''
  db.prepare('INSERT INTO reports (qid, reason) VALUES (?, ?)').run(b.qid, reason || '(no reason given)')
  return { ok: true }
}

// ponytail: scans every drill and drill attempt each call; fine for one person's months of data.
export function summary(): Summary {
  const date = today()
  const totalToday = drillFor(date).length
  const drills = db.prepare('SELECT date, ids FROM drills').all().map(r => ({ date: String(r.date), ids: json(r.ids) }))
  const answered = new Set(
    db.prepare("SELECT DISTINCT date || '|' || qid AS k FROM attempts WHERE mode = 'drill'").all().map(r => String(r.k)),
  )
  const done = doneDates(drills, answered)
  const answeredToday = [...answered].filter(k => k.startsWith(`${date}|`)).length
  return {
    date,
    ...streakInfo(done, date),
    week: [6, 5, 4, 3, 2, 1, 0].map(n => done.has(addDays(date, -n))),
    xp: xpFor(history(), done),
    golden: golden(date),
    doneToday: done.has(date),
    answeredToday,
    totalToday,
  }
}

export const topics = (): TopicRow[] =>
  db
    .prepare(
      `SELECT q.section, q.topic, COUNT(DISTINCT q.id) AS questions, COUNT(a.id) AS answered,
         COALESCE(SUM(a.correct), 0) AS right, COALESCE(AVG(a.ms), 0) AS avgMs,
         EXISTS (SELECT 1 FROM notes n WHERE n.topic = q.topic) AS note
       FROM questions q LEFT JOIN attempts a ON a.qid = q.id AND a.picked IS NOT NULL
       GROUP BY q.section, q.topic ORDER BY q.section, q.topic`,
    )
    .all()
    .map(r => ({
      section: r.section as TopicRow['section'],
      topic: String(r.topic),
      questions: Number(r.questions),
      answered: Number(r.answered),
      right: Number(r.right),
      avgMs: Math.round(Number(r.avgMs)),
      note: Number(r.note) === 1,
    }))

/** A short study set for one topic: its note plus 5 questions, unseen and due-for-revision first. */
export function studySet(topic: string) {
  const questions = buildDrill(
    allQuestions().filter(q => q.topic === topic),
    { seed: randomUUID(), date: today(), history: history(), size: 5, revision: 2 },
  )
  const note = db.prepare('SELECT text FROM notes WHERE topic = ?').get(topic)
  return { questions, passages: passagesFor(questions), answers: {}, note: note ? String(note.text) : undefined, golden: golden(today()) }
}

/** A fresh sectional test at the real question count, unseen questions first. */
export function testFor(section: string) {
  if (!isSection(section)) return { error: 'unknown section' }
  const questions = buildDrill(
    allQuestions().filter(q => q.section === section),
    { seed: randomUUID(), date: today(), history: history(), size: XAT[section].count, revision: 0 },
  )
  return { section, minutes: minutesFor(section), questions, passages: passagesFor(questions) }
}

export function submitTest(b: any) {
  if (!isSection(b?.section) || !Array.isArray(b.answers)) return { error: 'expected a section and a list of answers' }
  const results: (boolean | null)[] = []
  const rejected: string[] = []
  tx(() => {
    for (const a of b.answers) {
      const r = recordAttempt({ ...a, mode: 'test' })
      if ('error' in r) rejected.push(`${a?.qid}: ${r.error}`)
      else results.push(a.picked === null ? null : r.correct)
    }
  })
  return { ...score(results, b.section), rejected }
}

/** Everything in one JSON file. Its passages/questions/notes can be uploaded again as a bank. */
export function exportAll() {
  const all = (table: string) => db.prepare(`SELECT * FROM ${table}`).all()
  return {
    exportedAt: new Date().toISOString(),
    passages: all('passages').map(r => json(r.data)),
    questions: allQuestions(),
    notes: all('notes'),
    prefs: getPrefs(),
    attempts: all('attempts'),
    reports: all('reports'),
    drills: all('drills'),
  }
}

export const kvGet = (key: string) => {
  const r = db.prepare('SELECT value FROM kv WHERE key = ?').get(key)
  return r ? String(r.value) : undefined
}
export const kvSet = (key: string, value: string) => db.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)').run(key, value)
