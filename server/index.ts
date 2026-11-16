import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { type Context, Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import type { PracticeData } from '../shared/types.ts'
import {
  drillAnswers, drillFor, exportAll, getPrefs, importBank, passagesFor, recordAttempt, reportQuestion,
  setPrefs, studySet, submitTest, summary, testFor, topics,
} from './db.ts'
import { today } from './drill.ts'
import { publicKey, sendAll, startReminders, subscribe } from './push.ts'

const app = new Hono()

// Set APP_KEY on any server reachable from the internet; the app sends it as a Bearer token.
if (process.env.APP_KEY) app.use('/api/*', bearerAuth({ token: process.env.APP_KEY }))

const body = (c: Context) => c.req.json().catch(() => undefined)
const reply = (c: Context, r: object) => c.json(r, 'error' in r ? 400 : 200)

app.get('/api/drill/today', c => {
  const date = today()
  const questions = drillFor(date)
  return c.json<PracticeData>({ date, questions, passages: passagesFor(questions), answers: drillAnswers(date) })
})
app.get('/api/summary', c => c.json(summary()))
app.post('/api/attempts', async c => reply(c, recordAttempt(await body(c))))
app.post('/api/report', async c => reply(c, reportQuestion(await body(c))))

app.get('/api/topics', c => c.json(topics()))
app.get('/api/study/:topic', c => c.json<PracticeData>(studySet(c.req.param('topic'))))
app.get('/api/test/:section', c => reply(c, testFor(c.req.param('section'))))
app.post('/api/test/submit', async c => reply(c, submitTest(await body(c))))

app.get('/api/prefs', c => c.json(getPrefs()))
app.put('/api/prefs', async c => reply(c, setPrefs(await body(c))))

app.post('/api/import', async c => {
  const b = await body(c)
  if (b === undefined) return c.json({ error: 'File is not valid JSON' }, 400)
  return c.json(importBank(b))
})
app.get('/api/export', c => {
  c.header('content-disposition', `attachment; filename="xat-prep-${today()}.json"`)
  return c.json(exportAll())
})

app.get('/api/push/key', c => c.json({ key: publicKey }))
app.post('/api/push/subscribe', async c => reply(c, subscribe(await body(c))))
app.post('/api/push/test', async c => c.json(await sendAll({ title: 'XAT prep', body: 'Reminders are working.' })))

app.use('/*', serveStatic({ root: './dist' }))

startReminders()
const port = Number(process.env.PORT ?? 3000)
serve({ fetch: app.fetch, port }, () => console.log(`XAT prep server on http://localhost:${port}`))
