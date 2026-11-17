import { useEffect, useState } from 'react'
import { byId, doneCount, type MandalaDone, type MNode, ROOT } from '../../../shared/mandala.ts'
import type { TopicRow } from '../../../shared/types.ts'
import { api, message, post } from '../api.ts'

// Survive the study set taking over the screen (Study unmounts), so you come back where you were.
let lastAt = ''
let lastSel = ''

const slots = [0, 1, 2, 3, -1, 4, 5, 6, 7] // 3x3 grid cell → child index; -1 is the centre

/** One topic in the centre, its 8 parts around it. Concepts open a panel to study + quiz; passing turns them green. */
export function Mandala({ topics, onConcept }: { topics: TopicRow[]; onConcept: (c: MNode) => void }) {
  const [at, setAt] = useState(lastAt)
  const [sel, setSel] = useState(lastSel)
  const [done, setDone] = useState<MandalaDone>({})
  const [error, setError] = useState('')

  useEffect(() => {
    api<MandalaDone>('/api/mandala').then(setDone, e => setError(message(e)))
  }, [])
  useEffect(() => { lastAt = at; lastSel = sel }, [at, sel])

  const node = byId.get(at) ?? ROOT
  const concept = sel ? byId.get(sel) : undefined // '' is the root's id, not "nothing selected"
  const go = (n: MNode) => { setAt(n.id); setSel('') }
  const green = (n: MNode) => doneCount(n, done) === n.leaves
  const total = doneCount(ROOT, done)

  function mark(c: MNode, isDone: boolean) {
    post<MandalaDone>('/api/mandala', { id: c.id, done: isDone }).then(setDone, e => setError(message(e)))
  }

  const chain: MNode[] = []
  for (let n: MNode | undefined = node; n; n = n.parent) chain.unshift(n)

  return (
    <div className="mandala">
      <div className="m-head">
        <span>{total === ROOT.leaves ? 'The whole mandala is green.' : `${total} / ${ROOT.leaves} concepts green`}</span>
        {node.parent && <button className="link" onClick={() => go(node.parent!)}>↑ Up</button>}
      </div>
      <progress value={total} max={ROOT.leaves} aria-label="Concepts green" />

      <nav className="crumbs" aria-label="Mandala level">
        {chain.map((n, i) => (
          <button key={n.id} aria-current={i === chain.length - 1 ? 'page' : undefined} onClick={() => go(n)}>
            {i > 0 && '› '}{n.name}
          </button>
        ))}
      </nav>

      <div className="m-grid">
        {slots.map(k => {
          const n = k === -1 ? node : node.children[k]
          const centre = k === -1
          const leaf = !n.children.length
          const dc = doneCount(n, done)
          const cls = [centre && 'centre', green(n) && 'done', !!sel && n.id === sel && 'sel'].filter(Boolean).join(' ')
          return (
            <button
              key={n.id || 'root'}
              className={cls}
              disabled={centre && !node.parent}
              aria-label={centre ? `${n.name}, go up a level` : n.name}
              onClick={() => (centre ? go(node.parent!) : leaf ? setSel(n.id === sel ? '' : n.id) : go(n))}
            >
              <span className="m-meta">
                <span>{n.code}</span>
                <span>{leaf ? (dc ? '✓' : '') : `${dc}/${n.leaves}`}</span>
              </span>
              <span className="m-name">{n.name}</span>
            </button>
          )
        })}
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {concept && (
        <div className="m-panel">
          <p className="muted small">{concept.parent!.parent!.name} › {concept.parent!.name}</p>
          <h3>{concept.name}</h3>
          {done[concept.id] ? (
            <p className="ok">
              ✓ Green ({done[concept.id].score}).{' '}
              <button className="link" onClick={() => mark(concept, false)}>Mark not done</button>
            </p>
          ) : null}
          {concept.bank && topics.some(t => t.topic === concept.bank && t.questions) ? (
            <>
              <p className="muted">
                A short note on {concept.bank.replaceAll('-', ' ')}, then 5 questions. Get 4 right to turn this green.
              </p>
              <button className="primary" onClick={() => onConcept(concept)}>Study + quiz</button>
            </>
          ) : (
            <>
              <p className="muted">No bank questions for this yet. Study it your own way, then mark it done.</p>
              {!done[concept.id] && <button className="primary" onClick={() => mark(concept, true)}>Mark as done</button>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
