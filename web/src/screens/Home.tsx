import { useEffect, useState } from 'react'
import type { Summary } from '../../../shared/types.ts'
import { api, message } from '../api.ts'

const EXAM_DAY = '2027-01-03'

export function Home({ onStart }: { onStart: () => void }) {
  const [s, setS] = useState<Summary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Summary>('/api/summary').then(setS, e => setError(message(e)))
  }, [])

  if (error) return <p className="msg">{error}</p>
  if (!s) return <p className="msg">Loading…</p>

  const daysLeft = Math.round((Date.parse(EXAM_DAY) - Date.parse(s.date)) / 86_400_000)

  return (
    <section className="home">
      <p className="muted">XAT in {daysLeft} days</p>
      <p className="streak">
        <span className="big">{s.streak}</span> day streak
      </p>

      {s.totalToday === 0 ? (
        <p className="muted">No questions yet. Upload a question file in Settings.</p>
      ) : s.doneToday ? (
        <p>Today's drill is done.</p>
      ) : (
        <>
          <p className="muted">
            Today · {s.answeredToday} / {s.totalToday}
          </p>
          <progress value={s.answeredToday} max={s.totalToday} aria-label="Today's drill progress" />
          <button className="primary" onClick={onStart}>
            {s.answeredToday ? 'Continue' : 'Start'}
          </button>
        </>
      )}
    </section>
  )
}
