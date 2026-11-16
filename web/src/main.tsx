import { type ReactNode, StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
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
        />
      )}
      {tab === 'Stats' && <Stats />}
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
