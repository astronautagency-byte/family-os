self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; }
  catch { payload = { body: event.data?.text() || 'Your household has an update.' }; }
  event.waitUntil(self.registration.showNotification(payload.title || 'FamOS', {
    body: payload.body || 'Your household has an update.',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || 'famos-household-update',
    data: { url: payload.url || '/#today' },
    renotify: true,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/#today';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows[0];
    if (existing) return existing.navigate(target).then(() => existing.focus());
    return clients.openWindow(target);
  }));
});
