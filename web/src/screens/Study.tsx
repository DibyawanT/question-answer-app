import { useEffect, useState } from 'react'
import { XAT } from '../../../shared/scoring.ts'
import { SECTIONS, type TopicRow } from '../../../shared/types.ts'
import type { MNode } from '../../../shared/mandala.ts'
import { api, message } from '../api.ts'
import { Mandala } from './Mandala.tsx'

export const pct = (t: { right: number; answered: number }) => (t.answered ? `${Math.round((100 * t.right) / t.answered)}%` : '–')

export function Study({ onStart, onConcept, onSession }: { onStart: (topic: string) => void; onConcept: (c: MNode) => void; onSession: (topic: MNode) => void }) {
  const [topics, setTopics] = useState<TopicRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<TopicRow[]>('/api/topics').then(setTopics, e => setError(message(e)))
  }, [])

  if (error) return <p className="msg">{error}</p>
  if (!topics) return <p className="msg">Loading…</p>

  return (
    <section className="page">
      <h1>Study</h1>
      <Mandala topics={topics} onConcept={onConcept} onSession={onSession} />
      <h2>All topics</h2>
      <p className="muted">A short note, then 5 questions on the topic.</p>
      {!topics.length && <p className="muted">No questions yet. Upload a question file in Settings.</p>}
      {SECTIONS.filter(s => topics.some(t => t.section === s)).map(s => (
        <div key={s}>
          <h2>{XAT[s].name}</h2>
          <ul className="list">
            {topics.filter(t => t.section === s).map(t => (
              <li key={t.topic}>
                <button onClick={() => onStart(t.topic)}>
                  <span>{t.topic.replaceAll('-', ' ')}</span>
                  <span className="muted">{t.questions} Q · {pct(t)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
