import { useEffect, useState } from 'react'
import { XAT } from '../../../shared/scoring.ts'
import { SECTIONS, type Prefs, type TopicRow } from '../../../shared/types.ts'
import { api, message, post } from '../api.ts'

type ImportResult = { added: number; updated: number; passages: number; notes: number; rejected: { id: string; reason: string }[] }
const WEIGHTS = ['Off', 'Less', 'Normal', 'More', 'Most']

export function Settings() {
  return (
    <section className="page">
      <h1>Settings</h1>
      <AccessKey />
      <Upload />
      <Mix />
      <Reminders />
      <Backup />
    </section>
  )
}

function AccessKey() {
  const [key, setKey] = useState(() => localStorage.getItem('appKey') ?? '')
  const [saved, setSaved] = useState(false)
  return (
    <form className="block" onSubmit={e => (e.preventDefault(), localStorage.setItem('appKey', key.trim()), setSaved(true))}>
      <h2>Access key</h2>
      <p className="muted">The APP_KEY set on the server. Needed once per device.</p>
      <div className="row">
        <input type="password" autoComplete="current-password" value={key} onChange={e => (setKey(e.target.value), setSaved(false))} aria-label="Access key" />
        <button>{saved ? 'Saved' : 'Save'}</button>
      </div>
    </form>
  )
}

type FileResult = { name: string; result?: ImportResult; error?: string }

function Upload() {
  const [results, setResults] = useState<FileResult[]>([])
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)

  async function upload(list: FileList | null) {
    // Copy before any await: clearing the input empties the live FileList.
    const files = [...(list ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    if (busy || !files.length) return
    setBusy(true)
    setResults([])
    setTotal(files.length)
    // One at a time, in name order, so passages from an earlier file exist before later files point at them.
    for (const f of files) {
      let r: FileResult
      if (!/\.json$/i.test(f.name)) r = { name: f.name, error: 'not a .json file' }
      else {
        try { r = { name: f.name, result: await post<ImportResult>('/api/import', await f.text()) } }
        catch (e) { r = { name: f.name, error: message(e) } }
      }
      setResults(rs => [...rs, r])
    }
    setBusy(false)
  }

  const sum = (k: 'added' | 'updated' | 'notes') => results.reduce((n, r) => n + (r.result?.[k] ?? 0), 0)

  return (
    <div className="block">
      <h2>Add questions</h2>
      <p className="muted">JSON files with passages, questions and notes. Questions with an existing id are updated.</p>
      <label className={'drop' + (over ? ' over' : '')}
        onDragOver={e => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={e => (e.preventDefault(), setOver(false), upload(e.dataTransfer.files))}>
        <input type="file" accept=".json,application/json" multiple disabled={busy} aria-label="Question files"
          onChange={e => (upload(e.target.files), (e.target.value = ''))} />
        {busy ? `Uploading ${Math.min(results.length + 1, total)} of ${total}…` : 'Drop bank files here, or tap to choose'}
      </label>
      {results.length > 0 && (
        <div className="result" aria-live="polite">
          {!busy && total > 1 && <p>{sum('added')} added · {sum('updated')} updated · {sum('notes')} notes, from {total} files</p>}
          <ul className="files">
            {results.map(f => (
              <li key={f.name}>
                <b>{f.name}</b>{' '}
                {f.error
                  ? <span className="error">{f.error}</span>
                  : <span className="muted">{f.result!.added} added · {f.result!.updated} updated · {f.result!.passages} passages · {f.result!.notes} notes</span>}
                {f.result && f.result.rejected.length > 0 && (
                  <ul className="error">{f.result.rejected.map((r, k) => <li key={k}>{r.id}: {r.reason}</li>)}</ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Mix() {
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [topics, setTopics] = useState<TopicRow[]>([])
  const [status, setStatus] = useState('')

  useEffect(() => {
    api<Prefs>('/api/prefs').then(setPrefs, e => setStatus(message(e)))
    api<TopicRow[]>('/api/topics').then(setTopics, () => {})
  }, [])
  if (!prefs) return status ? <p className="error">{status}</p> : null

  // Slider positions 0–4 map to weights 0, 0.5, 1, 2, 3.
  const toWeight = [0, 0.5, 1, 2, 3]
  const pos = (key: string) => toWeight.indexOf(prefs[key] ?? 1)
  const set = (key: string, p: number) => {
    const { [key]: _, ...rest } = prefs
    setPrefs(toWeight[p] === 1 ? rest : { ...rest, [key]: toWeight[p] })
    setStatus('')
  }
  const slider = (key: string, label: string) => (
    <label key={key} className="slider">
      <span>{label}</span>
      <input type="range" min={0} max={4} value={pos(key)} onChange={e => set(key, Number(e.target.value))} />
      <span className="muted">{WEIGHTS[pos(key)]}</span>
    </label>
  )

  return (
    <div className="block">
      <h2>Question mix</h2>
      <p className="muted">How often each section or topic comes up in the daily drill. Applies from tomorrow's drill.</p>
      {SECTIONS.map(s => slider(`section:${s}`, XAT[s].name))}
      {topics.length > 0 && (
        <details>
          <summary className="muted">By topic</summary>
          {topics.map(t => slider(`topic:${t.topic}`, t.topic.replaceAll('-', ' ')))}
        </details>
      )}
      <button onClick={() => post('/api/prefs', prefs, 'PUT').then(() => setStatus('Saved'), e => setStatus(message(e)))}>
        Save mix
      </button>
      {status && <span className="muted"> {status}</span>}
    </div>
  )
}

function Reminders() {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const [status, setStatus] = useState(() => (supported && Notification.permission === 'granted' ? 'On for this device' : ''))

  async function enable() {
    setStatus('Turning on…')
    try {
      if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications are blocked for this site')
      const reg = await navigator.serviceWorker.ready
      const { key } = await api<{ key: string }>('/api/push/key')
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }))
      await post('/api/push/subscribe', sub)
      setStatus('On for this device')
    } catch (e) {
      setStatus(message(e))
    }
  }
  async function test() {
    try {
      const r = await post<{ sent: number; devices: number }>('/api/push/test', {})
      setStatus(`Sent to ${r.sent} of ${r.devices} devices`)
    } catch (e) {
      setStatus(message(e))
    }
  }

  return (
    <div className="block">
      <h2>Reminders</h2>
      <p className="muted">1 pm and 9 pm IST, only while today's drill isn't done. On Android, install the app from Chrome's menu first.</p>
      {supported ? (
        <div className="row">
          <button onClick={enable}>Turn on</button>
          <button onClick={test}>Send a test</button>
        </div>
      ) : (
        <p className="muted">This browser can't receive push notifications.</p>
      )}
      {status && <p className="muted">{status}</p>}
    </div>
  )
}

function Backup() {
  const [error, setError] = useState('')
  async function download() {
    setError('')
    try {
      const data = await api<unknown>('/api/export')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      a.download = `xat-prep-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      setError(message(e))
    }
  }
  return (
    <div className="block">
      <h2>Backup</h2>
      <p className="muted">Everything in one file: questions, answers, reports and settings.</p>
      <button onClick={download}>Download backup</button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  )
}
