const DESKTOP_AUTH_STATE_KEY = "famos:desktop-auth-state:v1";
const DESKTOP_CALLBACK = "famos://auth/callback";
const APP_ORIGIN = "https://home.fam-os.app";

export function isTauriRuntime() {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.__TAURI_INTERNALS__
    || window.__TAURI__
    || /^(?:tauri|asset):/i.test(window.location.protocol)
    || /\.tauri\.localhost$/i.test(window.location.hostname),
  );
}

export function isSafeDesktopCallback(value) {
  return typeof value === "string" && /^famos:\/\/auth\/callback(?:[/?#]|$)/i.test(value);
}

export function createDesktopAuthState() {
  const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`;
}

export function buildDesktopSignInUrl(state = createDesktopAuthState()) {
  if (typeof window !== "undefined") {
    try { window.sessionStorage.setItem(DESKTOP_AUTH_STATE_KEY, state); } catch { /* private mode */ }
  }
  const url = new URL("/sign-in", APP_ORIGIN);
  url.searchParams.set("desktop", "1");
  url.searchParams.set("callback", DESKTOP_CALLBACK);
  url.searchParams.set("state", state);
  return url.toString();
}

export function expectedDesktopAuthState() {
  if (typeof window === "undefined") return "";
  try { return window.sessionStorage.getItem(DESKTOP_AUTH_STATE_KEY) || ""; } catch { return ""; }
}

export function clearDesktopAuthState() {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(DESKTOP_AUTH_STATE_KEY); } catch { /* private mode */ }
}

export function getDesktopHandoffRequest(location = typeof window !== "undefined" ? window.location : null) {
  if (!location) return null;
  const params = new URLSearchParams(location.search || "");
  const callback = params.get("callback") || "";
  const state = params.get("state") || "";
  if (params.get("desktop") !== "1" || !state || !isSafeDesktopCallback(callback)) return null;
  return { callback, state };
}

export function parseDesktopAuthUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol.toLowerCase() !== "famos:" || url.hostname.toLowerCase() !== "auth" || url.pathname !== "/callback") return null;
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    return code && state ? { code, state } : null;
  } catch {
    return null;
  }
}

export async function openExternalUrl(url) {
  if (!url) return;
  if (isTauriRuntime()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function openDesktopSignIn() {
  const url = buildDesktopSignInUrl();
  if (!isTauriRuntime()) {
    window.location.assign(url);
    return url;
  }
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
  return url;
}

export async function listenForDesktopAuth(onAuth) {
  if (!isTauriRuntime()) return () => {};
  const { getCurrent, onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
  const process = (urls = []) => {
    for (const value of Array.isArray(urls) ? urls : [urls]) {
      const parsed = parseDesktopAuthUrl(value);
      if (parsed) onAuth(parsed);
    }
  };
  try { process(await getCurrent()); } catch { /* no cold-start URL */ }
  const unlisten = await onOpenUrl(process);
  return () => { try { unlisten?.(); } catch { /* listener already removed */ } };
}

export { DESKTOP_AUTH_STATE_KEY, DESKTOP_CALLBACK, APP_ORIGIN };
