import { isSection, type Note, type Passage, type Question } from '../shared/types.ts'

type Rejected = { id: string; reason: string }
const str = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

function passageError(p: any): string | undefined {
  if (!str(p?.id)) return 'missing id'
  if (!isSection(p.section)) return `bad section ${p.section}`
  if (!str(p.text)) return 'missing text'
}

function questionError(q: any, passages: Set<string>): string | undefined {
  if (!str(q?.id)) return 'missing id'
  if (!isSection(q.section)) return `bad section ${q.section}`
  for (const k of ['topic', 'stem', 'explanation']) if (!str(q[k])) return `missing ${k}`
  if (q.type !== undefined && !str(q.type)) return 'type must be text'
  if (q.source !== undefined && !str(q.source)) return 'source must be text'
  if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.every(str)) return 'options must be 2+ non-empty strings'
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) return 'answer out of range'
  if (q.setId !== undefined && !passages.has(q.setId)) return `unknown setId ${q.setId}`
}

function noteError(n: any): string | undefined {
  if (!str(n?.topic)) return 'missing topic'
  if (!str(n.text)) return 'missing text'
}

/** Checks an uploaded bank file. Bad items are rejected with a reason; good ones come back cleaned. */
export function validateImport(body: unknown, knownPassageIds: Set<string>) {
  const b = (body ?? {}) as Record<string, unknown>
  const list = (v: unknown): any[] => (Array.isArray(v) ? v : [])
  const rejected: Rejected[] = []

  function keep<T>(items: any[], key: string, error: (x: any) => string | undefined, clean: (x: any) => T): T[] {
    const seen = new Set<string>()
    return items.flatMap((x, i) => {
      const id = String(x?.[key] ?? `${key} #${i + 1}`)
      const reason = error(x) ?? (seen.has(id) ? 'duplicate id in file' : undefined)
      if (reason) return rejected.push({ id, reason }), []
      seen.add(id)
      return [clean(x)]
    })
  }

  const passages = keep<Passage>(list(b.passages), 'id', passageError, p => ({ id: p.id, section: p.section, text: p.text }))
  const passageIds = new Set([...knownPassageIds, ...passages.map(p => p.id)])
  const questions = keep<Question>(list(b.questions), 'id', q => questionError(q, passageIds), q => ({
    id: q.id, section: q.section, topic: q.topic, type: q.type, setId: q.setId,
    stem: q.stem, options: q.options, answer: q.answer, explanation: q.explanation, source: q.source,
  }))
  const notes = keep<Note>(list(b.notes), 'topic', noteError, n => ({ topic: n.topic, text: n.text }))
  return { passages, questions, notes, rejected }
}
