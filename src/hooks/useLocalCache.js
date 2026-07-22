// useLocalCache — TTL'd localStorage accessor. Returns `{ read, write, clear }`.
//
// Replaces the inline `famos_grocery_recipes_v1:*` helpers in Groceries.jsx
// and is ready for the discover-events tier (`famos_discover_events_v1:*`)
// to migrate when those two surfaces share a soft-tier contract.
//
// The hook is memoised by `(key, ttlMs)` so individual call sites don't
// re-allocate helper closures each render. Consumers compose the read/write
// timing themselves: read at fetch start, write on response, clear on user-
// initiated refresh. Each soft-tier surface keeps control of when to
// invalidate — the hook never decides that for you.

import { useMemo } from "react";

const readEntry = (key, ttlMs) => {
  if (typeof window === "undefined" || !key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.cachedAt !== "number") return null;
    if (Date.now() - entry.cachedAt > ttlMs) return null;
    return entry;
  } catch {
    return null;
  }
};

const writeEntry = (key, value) => {
  if (typeof window === "undefined" || !key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ cachedAt: Date.now(), ...value }));
  } catch {
    // Quota or private mode — silently no-op. Previous behaviour matches.
  }
};

const clearEntry = (key) => {
  if (typeof window === "undefined" || !key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore — cache is best-effort.
  }
};

export function useLocalCache(key, ttlMs) {
  return useMemo(() => {
    if (!key || typeof ttlMs !== "number") {
      return { read: () => null, write: () => {}, clear: () => {} };
    }
    return {
      read: () => readEntry(key, ttlMs),
      write: (value) => writeEntry(key, value),
      clear: () => clearEntry(key),
    };
  }, [key, ttlMs]);
}
