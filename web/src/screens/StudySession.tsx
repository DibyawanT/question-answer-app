import { type RefObject, useEffect, useReducer, useRef, useState } from 'react'
import type { MNode } from '../../../shared/mandala.ts'
import type { StudyTopic } from '../../../shared/types.ts'
import { initSocratic, type Rating, type SocraticAction, type SocraticState, socratic, type StepRecord, tally } from '../socratic.ts'
import { Tex } from '../Tex.tsx'

// Lazy: each section's file is its own chunk, fetched only when a session opens.
const files = import.meta.glob<StudyTopic[]>('../../../shared/study/*.json', { import: 'default' })

const VIEWS = ['Breakdown', 'Flashcards', 'Socratic'] as const
type View = (typeof VIEWS)[number]
const RATINGS: [Rating, string][] = [[1, 'Missed it'], [2, 'Close'], [3, 'Nailed it']]

/** True when a key press should be left to the focused control (typing in a field, Space/Enter on a button). */
const ownedByControl = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null
  return !!t?.closest('input, textarea, select, button, a, [contenteditable="true"]')
}

/** One mandala topic, studied three ways: a plain breakdown, flashcards per concept, and a guided Socratic loop. No score. */
export function StudySession({ topic, onExit }: { topic: MNode; onExit: () => void }) {
  const [data, setData] = useState<StudyTopic | null | undefined>(undefined) // undefined = loading, null = none
  const [view, setView] = useState<View>('Breakdown')

  useEffect(() => {
    const load = files[`../../../shared/study/s${topic.id.split('-')[0]}.json`]
    if (!load) return setData(null)
    load().then(list => setData(list.find(t => t.topicId === topic.id) ?? null), () => setData(null))
  }, [topic.id])

  const back = <button className="link" onClick={onExit}>← Exit</button>
  if (data === undefined) return <p className="msg">Loading…</p>
  if (!data)
    return (
      <section className="msg">
        {back}
        <p>No study session for this topic yet.</p>
      </section>
    )

  return (
    <article className="practice ss">
      <header>
        <div>
          <h1>{topic.name}</h1>
          <p className="muted small">{topic.parent?.name}</p>
        </div>
        {back}
      </header>
      <div className="ss-tabs" role="tablist" aria-label="Study mode">
        {VIEWS.map(v => (
          <button key={v} role="tab" id={`ss-tab-${v}`} aria-selected={v === view} aria-controls="ss-panel" onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>
      <div id="ss-panel" role="tabpanel" aria-labelledby={`ss-tab-${view}`}>
        {view === 'Breakdown' && <Breakdown s={data.simplified} />}
        {view === 'Flashcards' && <Flashcards cards={data.flashcards} />}
        {view === 'Socratic' && <SocraticSession steps={data.socratic} onFlashcards={() => setView('Flashcards')} />}
      </div>
    </article>
  )
}

function Breakdown({ s }: { s: StudyTopic['simplified'] }) {
  return (
    <>
      <p className="ss-core"><Tex>{s.coreIntuition}</Tex></p>
      <h2>Key points</h2>
      <ul className="ss-points">
        {s.keyPoints.map((p, i) => <li key={i}><Tex>{p}</Tex></li>)}
      </ul>
      <h2>Think of it like</h2>
      <p className="ss-quiet"><Tex>{s.analogy}</Tex></p>
    </>
  )
}

function Flashcards({ cards }: { cards: StudyTopic['flashcards'] }) {
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const go = (n: number) => { setI(n); setFlipped(false) }

  // Space flips even when the card itself isn't focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || ownedByControl(e)) return
      e.preventDefault()
      setFlipped(f => !f)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!cards.length) return <p className="muted">No flashcards for this topic yet.</p>
  const c = cards[i]
  return (
    <>
      <button className="ss-card" aria-pressed={flipped} onClick={() => setFlipped(f => !f)}>
        <span className="muted small">{flipped ? 'Answer' : 'Question'}</span>
        <span aria-live="polite">
          {/* key remounts the face so the flip animation replays */}
          <span key={`${i}-${flipped}`} className="ss-face">
            <Tex>{flipped ? c.back : c.front}</Tex>
          </span>
        </span>
      </button>
      <div className="ss-nav">
        <button onClick={() => go(i - 1)} disabled={i === 0}>Prev</button>
        <span className="muted">Card {i + 1} / {cards.length}</span>
        <button onClick={() => go(i + 1)} disabled={i === cards.length - 1}>Next</button>
      </div>
      <p className="muted small ss-center">Tap the card or press Space to flip.</p>
    </>
  )
}

type Step = StudyTopic['socratic'][number]

function SocraticSession({ steps, onFlashcards }: { steps: Step[]; onFlashcards: () => void }) {
  const [s, dispatch] = useReducer(socratic, steps.length, initSocratic)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || ownedByControl(e)) return
      const k = e.key.toLowerCase()
      const a: SocraticAction | null =
        k === 'h' ? { type: 'HINT' }
        : k === 'enter' ? { type: 'REVEAL' }
        : k === '1' || k === '2' || k === '3' ? { type: 'RATE', rating: Number(k) as Rating }
        : null
      if (!a) return
      e.preventDefault()
      dispatch(a) // the reducer ignores actions that don't fit the phase
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="ss-socratic">
      <SocraticProgressHUD s={s} />
      <ReasoningThread done={s.completed} steps={steps} />
      {s.phase === 'SESSION_COMPLETE' ? (
        <SynthesisSummaryCard s={s} steps={steps} onAgain={() => dispatch({ type: 'RESET', steps: steps.length })} onFlashcards={onFlashcards} />
      ) : (
        <ActiveSocraticCard s={s} step={steps[s.queue[s.pos]]} dispatch={dispatch} />
      )}
    </div>
  )
}

const ratingClass = (r: Rating) => (r === 1 ? 'missed' : r === 2 ? 'close' : 'nailed')

function SocraticProgressHUD({ s }: { s: SocraticState }) {
  return (
    <div className="ss-hud">
      <ol className="ss-segs" aria-label={`Step ${Math.min(s.pos + 1, s.queue.length)} of ${s.queue.length}`}>
        {s.queue.map((_, i) => (
          <li key={i} className={s.completed[i] ? ratingClass(s.completed[i].rating) : i === s.pos ? 'now' : ''} />
        ))}
      </ol>
      <span className="muted small">Hints used: {s.hints}</span>
    </div>
  )
}

function ReasoningThread({ done, steps }: { done: StepRecord[]; steps: Step[] }) {
  if (!done.length) return null
  return (
    <ol className="ss-thread" aria-label="Steps so far">
      {done.map((r, i) => (
        <li key={i}>
          <span><Tex>{steps[r.step].question}</Tex></span>
          <span><Tex>{steps[r.step].reveal}</Tex></span>
        </li>
      ))}
    </ol>
  )
}

function ActiveSocraticCard({ s, step, dispatch }: { s: SocraticState; step: Step; dispatch: (a: SocraticAction) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const reveal = useRef<HTMLDivElement>(null)
  const first = useRef(true)

  // New prompt → hunch input (not on first load, so the phone keyboard doesn't jump up); compare → the reveal.
  useEffect(() => {
    if (s.phase === 'COMPARING') reveal.current?.focus()
    else if (s.phase === 'PROMPTING' && !first.current) input.current?.focus()
    first.current = false
  }, [s.phase, s.pos])

  return (
    <section className="ss-active">
      <PromptBubble text={step.question} retry={s.completed.some(r => r.step === s.queue[s.pos])} />
      {s.phase === 'COMPARING' ? (
        <>
          <InsightComparison hunch={s.hunch} reveal={step.reveal} revealRef={reveal} />
          <CalibrationBar onRate={rating => dispatch({ type: 'RATE', rating })} />
        </>
      ) : (
        <>
          <HintDrawer open={s.phase === 'HINT_REVEALED'} hint={step.hint} onOpen={() => dispatch({ type: 'HINT' })} />
          <HypothesisComposer value={s.hunch} inputRef={input} onType={text => dispatch({ type: 'TYPE', text })} onReveal={() => dispatch({ type: 'REVEAL' })} />
        </>
      )}
    </section>
  )
}

function PromptBubble({ text, retry }: { text: string; retry: boolean }) {
  return (
    <div className="ss-prompt">
      {retry && <p className="muted small">One more go at this one</p>}
      <p><Tex>{text}</Tex></p>
    </div>
  )
}

function HintDrawer({ open, hint, onOpen }: { open: boolean; hint: string; onOpen: () => void }) {
  return (
    <div aria-live="polite">
      {open ? <p className="ss-quiet"><span className="muted">Hint: </span><Tex>{hint}</Tex></p> : <button className="link" onClick={onOpen}>Hint (H)</button>}
    </div>
  )
}

function HypothesisComposer(p: { value: string; inputRef: RefObject<HTMLInputElement | null>; onType: (t: string) => void; onReveal: () => void }) {
  return (
    <div className="ss-compose">
      <input
        ref={p.inputRef}
        className="ss-input"
        type="text"
        aria-label="Your hunch (optional)"
        placeholder="Jot a quick hunch..."
        value={p.value}
        onChange={e => p.onType(e.target.value)}
        onKeyDown={e => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          p.onReveal()
        }}
      />
      <button className="primary" onClick={p.onReveal}>I have a guess → Reveal</button>
    </div>
  )
}

function InsightComparison({ hunch, reveal, revealRef }: { hunch: string; reveal: string; revealRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="ss-compare">
      <p className="ss-hunch"><span className="muted small">Your hunch</span>{hunch || <span className="muted">No hunch jotted</span>}</p>
      <div ref={revealRef} tabIndex={-1} className="ss-reveal" aria-live="polite">
        <span className="muted small">Reveal</span>
        <p><Tex>{reveal}</Tex></p>
      </div>
    </div>
  )
}

function CalibrationBar({ onRate }: { onRate: (r: Rating) => void }) {
  return (
    <div className="ss-rate" role="group" aria-label="How close were you?">
      {RATINGS.map(([r, label]) => (
        <button key={r} className={ratingClass(r)} onClick={() => onRate(r)}>
          {label} <span className="muted small">({r})</span>
        </button>
      ))}
    </div>
  )
}

function SynthesisSummaryCard({ s, steps, onAgain, onFlashcards }: { s: SocraticState; steps: Step[]; onAgain: () => void; onFlashcards: () => void }) {
  const t = tally(s.completed)
  const head = useRef<HTMLHeadingElement>(null)
  useEffect(() => head.current?.focus(), [])
  return (
    <section className="ss-summary">
      <h3 ref={head} tabIndex={-1}>The chain of ideas</h3>
      <ol>
        {steps.map((st, i) => <li key={i}><Tex>{st.reveal}</Tex></li>)}
      </ol>
      <p className="muted">
        <span className="ok">Nailed {t.nailed}</span> · Close {t.close} · <span className="ss-miss">Missed {t.missed}</span> · Hints used {s.hints}
      </p>
      <button className="primary" onClick={onAgain}>Go again</button>
      <button className="ss-secondary" onClick={onFlashcards}>Back to flashcards</button>
    </section>
  )
}
