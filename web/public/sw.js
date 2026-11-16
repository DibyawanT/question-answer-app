// Push notifications only; no offline caching.
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : { title: 'XAT prep', body: '' }
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, icon: '/icon-192.png', tag: 'xat-reminder', renotify: true }))
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(ws => (ws.length ? ws[0].focus() : self.clients.openWindow('/'))),
  )
})
