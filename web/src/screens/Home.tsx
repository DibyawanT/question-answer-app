import { useEffect, useState } from 'react'
import { ROUND, XP } from '../../../shared/scoring.ts'
import type { Summary } from '../../../shared/types.ts'
import { api, message } from '../api.ts'
import { levelOf } from './Practice.tsx'

const EXAM_DAY = '2027-01-03'
const DAY = 86_400_000

export function Home({ onStart }: { onStart: () => void }) {
  const [s, setS] = useState<Summary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Summary>('/api/summary').then(setS, e => setError(message(e)))
  }, [])

  if (error) return <p className="msg">{error}</p>
  if (!s) return <p className="msg">Loading…</p>

  const daysLeft = Math.round((Date.parse(EXAM_DAY) - Date.parse(s.date)) / DAY)
  const round = Math.floor(s.answeredToday / ROUND) + 1
  const level = levelOf(s.xp)

  return (
    <section className="home">
      <p className="muted">XAT in {daysLeft} days</p>
      <p className="streak">
        <span className={s.doneToday ? 'flame lit' : 'flame'}>🔥</span>
        <span className="big">{s.streak}</span> day streak
      </p>

      <ol className="week" aria-label="Last 7 days">
        {s.week.map((done, k) => {
          const day = new Date(Date.parse(s.date) - (6 - k) * DAY)
          return (
            <li key={k} className={done ? 'done' : ''} aria-label={`${day.toLocaleDateString('en', { weekday: 'long', timeZone: 'UTC' })}: ${done ? 'done' : 'not done'}`}>
              {'SMTWTFS'[day.getUTCDay()]}
            </li>
          )
        })}
      </ol>

      <p className="muted hud">
        <span>⚡ {s.xp} XP · Level {level}</span>
        <span title="A missed day uses a freeze instead of resetting your streak. Every 7 days in a row earns one.">❄ {s.freezes}</span>
      </p>
      <progress value={s.xp % XP.level} max={XP.level} aria-label={`${XP.level - (s.xp % XP.level)} XP to level ${level + 1}`} />
      {s.golden && <p className="gold">Golden day · double XP</p>}

      <div className="today">
        {s.totalToday === 0 ? (
          <p className="muted">No questions yet. Upload a question file in Settings.</p>
        ) : s.doneToday ? (
          <p>Today's drill is done. Streak safe.</p>
        ) : (
          <>
            <p className="muted">
              Round {round} of {Math.ceil(s.totalToday / ROUND)} · {Math.min(ROUND, s.totalToday - s.answeredToday)} questions
            </p>
            <button className="primary" onClick={onStart}>
              {s.answeredToday ? `Continue · round ${round}` : 'Start'}
            </button>
          </>
        )}
      </div>
    </section>
  )
}
