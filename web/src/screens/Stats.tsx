import { useEffect, useState } from 'react'
import { XAT } from '../../../shared/scoring.ts'
import { SECTIONS, type TopicRow } from '../../../shared/types.ts'
import { api, message } from '../api.ts'
import { pct } from './Study.tsx'

const secs = (t: { avgMs: number; answered: number }) => (t.answered ? `${Math.round(t.avgMs / 1000)}s` : '–')

export function Stats() {
  const [topics, setTopics] = useState<TopicRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<TopicRow[]>('/api/topics').then(setTopics, e => setError(message(e)))
  }, [])

  if (error) return <p className="msg">{error}</p>
  if (!topics) return <p className="msg">Loading…</p>

  const sum = (rows: TopicRow[]) => {
    const answered = rows.reduce((n, t) => n + t.answered, 0)
    return {
      answered,
      right: rows.reduce((n, t) => n + t.right, 0),
      avgMs: answered ? rows.reduce((n, t) => n + t.avgMs * t.answered, 0) / answered : 0,
    }
  }
  const all = sum(topics)
  if (!all.answered) return <p className="msg">Answer a few questions and your accuracy shows up here.</p>

  const weakest = topics.filter(t => t.answered).sort((a, b) => a.right / a.answered - b.right / b.answered)

  return (
    <section className="page">
      <h1>Stats</h1>
      <p className="big">{pct(all)}</p>
      <p className="muted">{all.answered} answered · {secs(all)} per question</p>

      <table>
        <thead><tr><th>Section</th><th>Done</th><th>Right</th><th>Time</th></tr></thead>
        <tbody>
          {SECTIONS.map(s => {
            const r = sum(topics.filter(t => t.section === s))
            return <tr key={s}><td>{XAT[s].name}</td><td>{r.answered}</td><td>{pct(r)}</td><td>{secs(r)}</td></tr>
          })}
        </tbody>
      </table>

      <h2>Weakest first</h2>
      <table>
        <thead><tr><th>Topic</th><th>Done</th><th>Right</th><th>Time</th></tr></thead>
        <tbody>
          {weakest.map(t => (
            <tr key={t.section + t.topic}><td>{t.topic.replaceAll('-', ' ')}</td><td>{t.answered}</td><td>{pct(t)}</td><td>{secs(t)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
