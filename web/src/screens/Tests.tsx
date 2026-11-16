import { useEffect, useRef, useState } from 'react'
import { minutesFor, XAT } from '../../../shared/scoring.ts'
import { SECTIONS, type Section, type TestData, type TestResult } from '../../../shared/types.ts'
import { api, message, post } from '../api.ts'
import { letter, QuestionView } from './Practice.tsx'

export function Tests({ onStart }: { onStart: (s: Section) => void }) {
  return (
    <section className="page">
      <h1>Sectional test</h1>
      <p className="muted">Real timer and marking: +1 right, −0.25 wrong, −0.10 per skip after 8. GK has no negatives.</p>
      <ul className="list">
        {SECTIONS.map(s => (
          <li key={s}>
            <button onClick={() => onStart(s)}>
              <span>{XAT[s].name}</span>
              <span className="muted">{XAT[s].count} Q · {minutesFor(s)} min</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ponytail: an in-progress test lives only in memory; a reload loses it. Persist picks if that bites.
export function TestRun({ section, onExit }: { section: Section; onExit: () => void }) {
  const [data, setData] = useState<TestData | null>(null)
  const [error, setError] = useState('')
  const [i, setI] = useState(0)
  const [picks, setPicks] = useState<Record<string, number>>({})
  const [endsAt, setEndsAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [result, setResult] = useState<TestResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const spent = useRef<Record<string, number>>({})
  const shownAt = useRef(Date.now())

  useEffect(() => {
    api<TestData>(`/api/test/${section}`).then(d => {
      const start = Date.now()
      setData(d)
      setNow(start)
      setEndsAt(start + d.minutes * 60_000)
      shownAt.current = start
    }, e => setError(message(e)))
  }, [section])

  useEffect(() => {
    if (!endsAt || result) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [endsAt, result])

  // Time's up: submit whatever is answered.
  useEffect(() => {
    if (endsAt && now >= endsAt && !result && !submitting) submit()
  }, [now])

  if (error && !data) return <section className="msg"><button className="link" onClick={onExit}>← Back</button><p>{error}</p></section>
  if (!data) return <p className="msg">Loading…</p>
  if (!data.questions.length)
    return <section className="msg"><button className="link" onClick={onExit}>← Back</button><p>No {XAT[section].name} questions yet.</p></section>
  if (result) return <TestReview data={data} picks={picks} result={result} onExit={onExit} />

  const q = data.questions[i]
  const total = data.questions.length

  function track() {
    const id = data!.questions[i].id
    spent.current[id] = (spent.current[id] ?? 0) + Date.now() - shownAt.current
    shownAt.current = Date.now()
  }
  function go(k: number) {
    track()
    setI(k)
  }
  function pick(k: number) {
    setPicks(p => {
      const { [q.id]: old, ...rest } = p
      return old === k ? rest : { ...rest, [q.id]: k } // tap again to clear
    })
  }
  async function submit() {
    track()
    setSubmitting(true)
    setError('')
    try {
      const answers = data!.questions.map(x => ({ qid: x.id, picked: picks[x.id] ?? null, ms: spent.current[x.id] ?? 0 }))
      setResult(await post<TestResult>('/api/test/submit', { section, answers }))
    } catch (e) {
      setError(`Couldn't submit: ${message(e)}`)
    }
    setSubmitting(false)
  }
  function quit() {
    if (confirm('Quit this test? Nothing will be saved.')) onExit()
  }

  const left = endsAt - now
  const answered = Object.keys(picks).length

  return (
    <article className="practice">
      <header>
        <button className="link" onClick={quit}>Quit</button>
        <span className={left < 5 * 60_000 ? 'timer low' : 'timer'}>{clock(left)}</span>
        <span className="muted">{i + 1} / {total}</span>
      </header>
      <QuestionView
        q={q}
        passage={data.passages.find(p => p.id === q.setId)}
        onPick={pick}
        mark={k => (picks[q.id] === k ? 'picked' : '')}
      />
      <div className="row">
        <button onClick={() => go(i - 1)} disabled={i === 0}>Previous</button>
        <button onClick={() => go(i + 1)} disabled={i === total - 1}>Next</button>
      </div>
      <details className="palette">
        <summary className="muted">All questions · {answered} answered</summary>
        <div className="grid">
          {data.questions.map((x, k) => (
            <button key={x.id} className={(x.id in picks ? 'done' : '') + (k === i ? ' here' : '')} onClick={() => go(k)}>
              {k + 1}
            </button>
          ))}
        </div>
      </details>
      {error && <p className="error" role="alert">{error}</p>}
      <button
        className="primary"
        disabled={submitting}
        onClick={() => confirm(`Submit with ${answered} of ${total} answered?`) && submit()}
      >
        {submitting ? 'Submitting…' : error ? 'Try submitting again' : 'Submit'}
      </button>
    </article>
  )
}

function TestReview({ data, picks, result, onExit }: { data: TestData; picks: Record<string, number>; result: TestResult; onExit: () => void }) {
  return (
    <section className="page">
      <p className="muted">{XAT[data.section].name}</p>
      <p className="big">{result.score} <span className="muted">/ {result.max}</span></p>
      <p className="muted">{result.right} right · {result.wrong} wrong · {result.skipped} skipped</p>
      <ol className="review">
        {data.questions.map(q => {
          const p = picks[q.id]
          const mark = p === undefined ? '–' : p === q.answer ? '✓' : '✗'
          return (
            <li key={q.id}>
              <details>
                <summary><b className={mark === '✓' ? 'ok' : mark === '✗' ? 'bad' : ''}>{mark}</b> {q.stem.split('\n')[0]}</summary>
                <p>
                  {p !== undefined && p !== q.answer && <>You: {letter(p)}. {q.options[p]}<br /></>}
                  Answer: {letter(q.answer)}. {q.options[q.answer]}
                </p>
                <p className="muted">{q.explanation}</p>
              </details>
            </li>
          )
        })}
      </ol>
      <button className="primary" onClick={onExit}>Done</button>
    </section>
  )
}
