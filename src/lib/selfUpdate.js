// Self-healing PWA updates. The service worker is registered by the
// injected registerSW.js with autoUpdate + skipWaiting, but a PWA tab or
// installed app that stays open never triggers a navigation, so the browser
// never runs its update check and the old build keeps serving forever. This
// module force-checks for a newer worker on load and whenever the app
// regains focus (returning to a backgrounded tab/app), activates any
// waiting worker, and reloads once it takes control.
export function setupSelfUpdate() {
  if (!("serviceWorker" in navigator)) return;

  const reloadOnce = () => {
    // Never let an update loop hammer the page — one reload per 30s max.
    const key = "famos:self-update-reload";
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  };

  const applyPending = (registration) => {
    if (!registration.waiting) return;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    navigator.serviceWorker.addEventListener("controllerchange", reloadOnce, { once: true });
  };

  const check = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return;
      applyPending(registration);
      // Force a byte-check against the network even when the browser thinks
      // it is up to date (covers long-lived tabs whose check never ran).
      await registration.update();
      applyPending(registration);
    } catch { /* update checks must never break the app */ }
  };

  window.addEventListener("load", check);
  window.addEventListener("focus", check);
  window.addEventListener("pageshow", check);
}