import * as webpush from 'web-push'
import { db, kvGet, kvSet, summary } from './db.ts'
import { reminderDue } from './drill.ts'

// VAPID keys are made once and kept in the database, so subscriptions survive restarts and redeploys.
let keys = kvGet('vapid')
if (!keys) {
  keys = JSON.stringify(webpush.generateVAPIDKeys())
  kvSet('vapid', keys)
}
const vapid: { publicKey: string; privateKey: string } = JSON.parse(keys)
webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:xat-prep@example.com', vapid.publicKey, vapid.privateKey)

export const publicKey = vapid.publicKey

export function subscribe(sub: any) {
  if (typeof sub?.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || typeof sub.keys?.p256dh !== 'string')
    return { error: 'not a push subscription' }
  db.prepare('INSERT OR REPLACE INTO push_subs (endpoint, data) VALUES (?, ?)').run(sub.endpoint, JSON.stringify(sub))
  return { ok: true }
}

/** Sends to every subscribed device; drops devices the push service says are gone. */
export async function sendAll(payload: { title: string; body: string }) {
  const subs = db.prepare('SELECT endpoint, data FROM push_subs').all()
  let sent = 0
  await Promise.all(
    subs.map(s =>
      webpush.sendNotification(JSON.parse(String(s.data)), JSON.stringify(payload)).then(
        () => sent++,
        e => {
          if (e.statusCode === 404 || e.statusCode === 410) db.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(s.endpoint)
          else console.error('push failed', e.statusCode ?? e.message)
        },
      ),
    ),
  )
  return { sent, devices: subs.length }
}

const sentSlot = db.prepare('SELECT 1 FROM reminder_log WHERE slot = ?')
const logSlot = db.prepare('INSERT OR IGNORE INTO reminder_log (slot) VALUES (?)')

async function tick() {
  const s = summary()
  if (!s.totalToday) return
  const slot = reminderDue(new Date(), slot => !!sentSlot.get(slot), s.doneToday)
  if (!slot) return
  logSlot.run(slot)
  const left = s.totalToday - s.answeredToday
  const body = slot.endsWith('|13')
    ? `Today's drill is waiting: ${left} questions.`
    : `Drill still not done: ${left} questions left. Finish it before bed.`
  await sendAll({ title: s.streak ? `XAT prep · ${s.streak} day streak` : 'XAT prep', body })
}

/** Checks every minute whether a 1 pm / 9 pm IST reminder is due. */
export function startReminders() {
  setInterval(() => tick().catch(e => console.error('reminder tick failed', e)), 60_000)
}
