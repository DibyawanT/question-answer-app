import { useEffect, useRef, useState } from 'react'
import type { Mode, Passage, PracticeData, Question } from '../../../shared/types.ts'
import { api, message, post } from '../api.ts'

export const letter = (k: number) => String.fromCharCode(65 + k)

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
          <p>{passage.text}</p>
        </details>
      )}
      <p className="stem">{q.stem}</p>
      <ul className="options">
        {q.options.map((o, k) => (
          <li key={k}>
            <button disabled={disabled} className={mark(k)} onClick={() => onPick(k)}>
              <b>{letter(k)}</b> <span>{o}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

/** One question at a time with instant feedback. Used by the daily drill and study sets. */
export function Practice({ url, mode, title, onExit }: { url: string; mode: Mode; title: string; onExit: () => void }) {
  const [data, setData] = useState<PracticeData | null>(null)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [saveError, setSaveError] = useState('')
  const [reported, setReported] = useState(false)
  const shownAt = useRef(Date.now())

  useEffect(() => {
    api<PracticeData>(url).then(d => {
      // Resume at the first unanswered question.
      const first = d.questions.findIndex(q => !(q.id in d.answers))
      setI(first === -1 ? d.questions.length : first)
      setScore(d.questions.filter(q => d.answers[q.id] === q.answer).length)
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
        <p className="note">{data.note}</p>
        <button className="primary" onClick={() => setStarted(true)}>{total} questions</button>
      </article>
    )

  if (i >= total)
    return (
      <section className="msg">
        <p className="muted">{title}</p>
        <p className="big">{score} / {total}</p>
        <button className="primary" onClick={onExit}>Done</button>
      </section>
    )

  const q = data.questions[i]
  const answered = picked !== null

  function pick(k: number) {
    setPicked(k)
    if (k === q.answer) setScore(s => s + 1)
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
  }

  return (
    <article className="practice">
      <header>
        {back}
        <span className="muted">{i + 1} / {total}</span>
      </header>
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
            <strong>{picked === q.answer ? 'Correct.' : `Answer ${letter(q.answer)}.`}</strong> {q.explanation}
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
