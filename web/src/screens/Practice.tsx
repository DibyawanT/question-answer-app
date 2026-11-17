import { useEffect, useRef, useState } from 'react'
import { ROUND, XP } from '../../../shared/scoring.ts'
import type { Mode, Passage, PracticeData, Question, Summary } from '../../../shared/types.ts'
import { api, message, post } from '../api.ts'
import { Tex } from '../Tex.tsx'

export const letter = (k: number) => String.fromCharCode(65 + k)
export const levelOf = (xp: number) => Math.floor(xp / XP.level) + 1

type Result = boolean | undefined // right, wrong, not answered yet
const longestRun = (rs: Result[]) => rs.reduce((s, r) => ((s.run = r ? s.run + 1 : 0), (s.best = Math.max(s.best, s.run)), s), { run: 0, best: 0 }).best

/** The payoff after a finished daily drill: the streak and XP as they now stand. */
function StreakReveal() {
  const [s, setS] = useState<Summary | null>(null)
  useEffect(() => {
    api<Summary>('/api/summary').then(setS, () => {})
  }, [])
  if (!s) return null
  return (
    <>
      <p className="pop"><span className="flame lit">🔥</span> {s.streak} day streak</p>
      <p className="muted">⚡ {s.xp} XP · Level {levelOf(s.xp)}</p>
    </>
  )
}

/** Passage (if any), stem and options. `mark` decides each option's class. */
export function QuestionView({ q, passage, mark, onPick, disabled }: {
  q: Question
  passage?: Passage
  mark: (k: number) => string
  onPick: (k: number) => void
  disabled?: boolean
}) {
  return (
    <>
      {passage && (
        <details className="passage" open>
          <summary>{q.section === 'DM' ? 'Caselet' : q.section === 'QADI' ? 'Data' : 'Passage'}</summary>
          <p><Tex>{passage.text}</Tex></p>
        </details>
      )}
      <p className="stem"><Tex>{q.stem}</Tex></p>
      <ul className="options">
        {q.options.map((o, k) => (
          <li key={k}>
            <button disabled={disabled} className={mark(k)} onClick={() => onPick(k)}>
              <b>{letter(k)}</b> <span><Tex>{o}</Tex></span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

/** One question at a time with instant feedback. Used by the daily drill and study sets. */
export function Practice({ url, mode, title, onExit, onDone }: {
  url: string
  mode: Mode
  title: string
  onExit: () => void
  onDone?: (right: number, total: number) => void // called instead of onExit when the set is finished
}) {
  const [data, setData] = useState<PracticeData | null>(null)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [resting, setResting] = useState(false) // on the reward screen between rounds
  const [saveError, setSaveError] = useState('')
  const [reported, setReported] = useState(false)
  const shownAt = useRef(Date.now())

  useEffect(() => {
    api<PracticeData>(url).then(d => {
      // Resume at the first unanswered question.
      const first = d.questions.findIndex(q => !(q.id in d.answers))
      setI(first === -1 ? d.questions.length : first)
      setResults(d.questions.map(q => (q.id in d.answers ? d.answers[q.id] === q.answer : undefined)))
      setData(d)
    }, e => setError(message(e)))
  }, [url])

  useEffect(() => {
    shownAt.current = Date.now()
  }, [i, started])

  const back = <button className="link" onClick={onExit}>← Back</button>
  if (error) return <section className="msg">{back}<p>{error}</p></section>
  if (!data) return <p className="msg">Loading…</p>
  const total = data.questions.length
  if (!total) return <section className="msg">{back}<p>No questions for this yet.</p></section>

  if (data.note && !started)
    return (
      <article className="practice">
        <header>{back}<span className="muted">{title}</span></header>
        <p className="note"><Tex>{data.note}</Tex></p>
        <button className="primary" onClick={() => setStarted(true)}>{total} questions</button>
      </article>
    )

  const rounds = Math.ceil(total / ROUND)

  if (i >= total)
    return (
      <section className="msg reward">
        <p className="muted">{title}</p>
        <p className="big pop">{results.filter(Boolean).length} / {total}</p>
        {mode === 'drill' && <StreakReveal />}
        <button className="primary" onClick={() => (onDone ? onDone(results.filter(Boolean).length, total) : onExit())}>Done</button>
      </section>
    )

  if (resting) {
    const round = results.slice(i - ROUND, i)
    const run = longestRun(round)
    const xp = round.reduce((n, r) => n + (r ? XP.right : XP.wrong), 0) * (data.golden ? 2 : 1)
    return (
      <section className="msg reward">
        <p className="muted">Round {i / ROUND} of {rounds} done</p>
        <p className="big pop">+{xp} XP</p>
        <p>
          {round.filter(Boolean).length} / {ROUND} right{run >= 3 && ` · ${run} in a row`}{data.golden && ' · golden day, double XP'}
        </p>
        <button className="primary" onClick={() => setResting(false)}>Next round · {Math.min(ROUND, total - i)} questions</button>
        <button className="link center" onClick={onExit}>Stop here. It's saved.</button>
      </section>
    )
  }

  const q = data.questions[i]
  const answered = picked !== null
  const roundStart = i - (i % ROUND)
  const roundSize = Math.min(ROUND, total - roundStart)

  function pick(k: number) {
    setPicked(k)
    setResults(rs => rs.map((r, j) => (j === i ? k === q.answer : r)))
    if (k === q.answer) navigator.vibrate?.(30)
    post('/api/attempts', { qid: q.id, picked: k, ms: Date.now() - shownAt.current, mode, date: data!.date })
      .then(() => setSaveError(''), e => setSaveError(`Not saved: ${message(e)}`))
  }

  function report() {
    const reason = prompt('What is wrong with this question?')
    if (reason === null) return
    post('/api/report', { qid: q.id, reason }).then(() => setReported(true), e => setSaveError(`Report not sent: ${message(e)}`))
  }

  function next() {
    setI(i + 1)
    setPicked(null)
    setReported(false)
    // A breather after every full round, except after the last one (that goes to the final screen).
    setResting((i + 1) % ROUND === 0 && i + 1 < total)
  }

  return (
    <article className="practice">
      <header>
        {back}
        <span className="muted">
          {rounds > 1 && `Round ${roundStart / ROUND + 1} of ${rounds} · `}{i - roundStart + 1} / {roundSize}
        </span>
      </header>
      <progress value={i - roundStart + (answered ? 1 : 0)} max={roundSize} aria-label="Progress in this round" />
      <QuestionView
        q={q}
        passage={data.passages.find(p => p.id === q.setId)}
        disabled={answered}
        onPick={pick}
        mark={k => (answered && k === q.answer ? 'right' : answered && k === picked ? 'wrong' : '')}
      />
      {saveError && <p className="error" role="alert">{saveError}</p>}
      {answered && (
        <>
          <p className="explanation">
            <strong>{picked === q.answer ? 'Correct.' : `Not yet. It's ${letter(q.answer)}.`}</strong> <Tex>{q.explanation}</Tex>
          </p>
          <button className="primary" onClick={next}>{i + 1 < total ? 'Next' : 'Finish'}</button>
          <button className="link center" onClick={report} disabled={reported}>
            {reported ? 'Reported' : 'Report a problem'}
          </button>
        </>
      )}
    </article>
  )
}
