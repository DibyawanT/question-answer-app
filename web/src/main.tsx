import { type ReactNode, StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { passMark } from '../../shared/mandala.ts'
import { post } from './api.ts'
import { Home } from './screens/Home.tsx'
import { Practice } from './screens/Practice.tsx'
import { Settings } from './screens/Settings.tsx'
import { Stats } from './screens/Stats.tsx'
import { Study } from './screens/Study.tsx'
import { TestRun, Tests } from './screens/Tests.tsx'
import './styles.css'

const TABS = ['Today', 'Test', 'Study', 'Stats', 'Settings'] as const

function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Today')
  // A drill, test or study set takes the whole screen, with no tab bar to distract.
  const [focus, setFocus] = useState<ReactNode>(null)
  const close = () => setFocus(null)
  const busy = focus !== null

  // After a deploy, reload when the app comes back to the foreground, but never mid-drill or mid-test.
  useEffect(() => {
    if (busy) return
    const check = async () => {
      if (document.visibilityState !== 'visible') return
      const html = await fetch('/', { cache: 'no-store' }).then(r => r.text(), () => '')
      const latest = html.match(/\/assets\/index-[\w-]+\.js/)?.[0]
      if (latest && !document.querySelector(`script[src="${latest}"]`)) location.reload()
    }
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [busy])

  if (focus) return focus

  return (
    <>
      {tab === 'Today' && (
        <Home onStart={() => setFocus(<Practice url="/api/drill/today" mode="drill" title="Today's drill" onExit={close} />)} />
      )}
      {tab === 'Test' && <Tests onStart={s => setFocus(<TestRun section={s} onExit={close} />)} />}
      {tab === 'Study' && (
        <Study
          onStart={t =>
            setFocus(<Practice url={`/api/study/${encodeURIComponent(t)}`} mode="study" title={t} onExit={close} />)
          }
          onConcept={c =>
            setFocus(
              <Practice
                url={`/api/study/${encodeURIComponent(c.bank!)}`}
                mode="study"
                title={c.name}
                onExit={close}
                onDone={async (right, total) => {
                  // Passing turns the concept green; save before closing so the mandala reloads with it.
                  if (right >= passMark(total))
                    await post('/api/mandala', { id: c.id, done: true, score: `${right}/${total}` }).catch(() => {})
                  close()
                }}
              />,
            )
          }
        />
      )}
      {tab === 'Stats' && (
        <Stats
          onMistakes={(title, section, topic) => {
            const q = new URLSearchParams({ ...(section && { section }), ...(topic && { topic }) })
            setFocus(<Practice url={`/api/mistakes?${q}`} mode="study" title={title} onExit={close} />)
          }}
        />
      )}
      {tab === 'Settings' && <Settings />}
      <nav className="tabs">
        {TABS.map(t => (
          <button key={t} aria-current={t === tab ? 'page' : undefined} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
    </>
  )
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main>
      <App />
    </main>
  </StrictMode>,
)
