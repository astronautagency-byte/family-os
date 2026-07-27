self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data?.json() || {};  } catch { payload = { body: event.data?.text() || 'Your household has an update.' }; }
  // Pre-absolutize the URL at write-time so every future reader of
  // event.notification.data.url inherits an absolute URL. Stored
  // relative URLs have caused "Safari cannot open the page because the
  // address is invalid" because iOS Safari's clients.openWindow /
  // WindowClient.navigate APIs require absolute paths inside an SW.
  const rawUrl = payload.url || '/#today';
  let resolvedUrl;
  try { resolvedUrl = new URL(rawUrl, self.location.origin).href; }
  catch { console.warn("notification-sw: invalid url in push payload, falling back to origin", rawUrl); resolvedUrl = self.location.origin; }
  event.waitUntil(self.registration.showNotification(payload.title || 'FamOS', {
    body: payload.body || 'Your household has an update.',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || 'famos-household-update',
    data: { url: resolvedUrl },
    renotify: true,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/#today';
  // Resolve relative URLs ("/#today", "/meals", etc.) to absolute
  // URLs against this service worker's origin before handing them to
  // clients.openWindow / clients.navigate. iOS Safari rejects relative
  // URLs with "Safari cannot open the page because the address is
  // invalid" — every documented iOS Safari push-doesn't-open bug
  // traces back to this. Absolute URLs are required by the spec.
  let absoluteUrl;
  try { absoluteUrl = new URL(target, self.location.origin).href; }
  catch { console.warn("notification-sw: invalid url in notification data, falling back to origin", target); absoluteUrl = self.location.origin; }
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows[0];
    if (existing) return existing.navigate(absoluteUrl).then(() => existing.focus());
    return clients.openWindow(absoluteUrl);
  }));
});
