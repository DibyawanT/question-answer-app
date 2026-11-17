import { useEffect, useState } from 'react'
import { paceFor, smoothed, XAT } from '../../../shared/scoring.ts'
import { SECTIONS, type Section, type TopicRow } from '../../../shared/types.ts'
import { api, message } from '../api.ts'
import { pct } from './Study.tsx'

type Totals = { answered: number; right: number; recentAnswered: number; recentRight: number; avgMs: number; open: number }

const secs = (t: Totals) => (t.answered ? `${Math.round(t.avgMs / 1000)}s` : '–')
const name = (topic: string) => topic.replaceAll('-', ' ')

function sum(rows: TopicRow[]): Totals {
  const add = (k: keyof Totals) => rows.reduce((n, t) => n + (t[k] as number), 0)
  const answered = add('answered')
  return {
    answered,
    right: add('right'),
    recentAnswered: add('recentAnswered'),
    recentRight: add('recentRight'),
    avgMs: answered ? rows.reduce((n, t) => n + t.avgMs * t.answered, 0) / answered : 0,
    open: add('open'),
  }
}

/** Last-7-days accuracy, with an arrow when it differs from all-time by 5 points or more (and there are 3+ answers). */
function Trend({ t }: { t: Totals }) {
  if (!t.recentAnswered) return <>–</>
  const diff = (100 * t.recentRight) / t.recentAnswered - (100 * t.right) / t.answered
  const arrow = t.recentAnswered < 3 || Math.abs(diff) < 5 ? '' : diff > 0 ? ' ↑' : ' ↓'
  return <span className={arrow === ' ↑' ? 'ok' : arrow === ' ↓' ? 'bad' : ''}>{pct({ right: t.recentRight, answered: t.recentAnswered })}{arrow}</span>
}

export function Stats({ onMistakes }: { onMistakes: (title: string, section?: Section, topic?: string) => void }) {
  const [topics, setTopics] = useState<TopicRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<TopicRow[]>('/api/topics').then(setTopics, e => setError(message(e)))
  }, [])

  if (error) return <p className="msg">{error}</p>
  if (!topics) return <p className="msg">Loading…</p>

  const all = sum(topics)
  if (!all.answered && !all.open) return <p className="msg">Answer a few questions and your accuracy shows up here.</p>

  // Smoothed so a topic with one wrong answer doesn't outrank one you've missed many times.
  const weakest = topics
    .filter(t => t.answered || t.open)
    .sort((a, b) => smoothed(a.right, a.answered) - smoothed(b.right, b.answered) || b.open - a.open)

  return (
    <section className="page">
      <h1>Stats</h1>
      <p className="big">{pct(all)}</p>
      <p className="muted">{all.answered} answered · {secs(all)} per question · last 7 days <Trend t={all} /></p>

      {all.open > 0 && (
        <div className="mistakes">
          <h2>Fix my mistakes</h2>
          <p className="muted">{all.open} questions you got wrong or skipped. Get one right and it's cleared.</p>
          <button className="primary" onClick={() => onMistakes('Mistakes')}>
            Practice mistakes · {Math.min(all.open, 20)} questions
          </button>
          <ul className="list">
            {SECTIONS.map(s => {
              const open = sum(topics.filter(t => t.section === s)).open
              return open > 0 && (
                <li key={s}>
                  <button onClick={() => onMistakes(`${XAT[s].name} mistakes`, s)}>
                    <span>{XAT[s].name}</span><span className="bad">{open} →</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <h2>By section</h2>
      <p className="muted">Time is your average per question / the real exam's pace. Red = slower.</p>
      <table>
        <thead><tr><th>Section</th><th>Done</th><th>Right</th><th>7d</th><th>Time</th></tr></thead>
        <tbody>
          {SECTIONS.map(s => {
            const r = sum(topics.filter(t => t.section === s))
            const slow = r.answered > 0 && r.avgMs / 1000 > paceFor(s)
            return (
              <tr key={s}>
                <td>{XAT[s].name}</td><td>{r.answered}</td><td>{pct(r)}</td><td><Trend t={r} /></td>
                <td className="nowrap"><span className={slow ? 'bad' : ''}>{secs(r)}</span><span className="muted">/{paceFor(s)}s</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h2>Weakest first</h2>
      <table>
        <thead><tr><th>Topic</th><th>Done</th><th>Right</th><th>7d</th><th>Open</th></tr></thead>
        <tbody>
          {weakest.map(t => (
            <tr key={t.section + t.topic}>
              <td>{name(t.topic)}</td><td>{t.answered}</td><td>{pct(t)}</td><td><Trend t={t} /></td>
              <td>
                {t.open > 0
                  ? <button className="link bad" onClick={() => onMistakes(`${name(t.topic)} mistakes`, t.section, t.topic)}>{t.open} →</button>
                  : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
