// localStorage cache for event-search responses.
// TTL: 4 hours. Key: country + when + dropdown category + sorted cities.
// Versioned prefix so future schema changes invalidate cleanly.
// Errors are never cached (only successful responses with results).

const STORAGE_PREFIX = "famos_event_search:v1:";
const TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

const safeStorage = () => {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

const normalizeForKey = (value) => String(value ?? "").trim().toLowerCase();

/**
 * Build a stable cache key from the request input the user controls.
 * Sorting the cities is the only non-obvious step — it means
 * ["Toronto", "Newmarket"] and ["Newmarket", "Toronto"] hit the same entry,
 * since the edge function dedupes the same way.
 */
export function eventCacheKey({ category, when, country, cities }) {
  const sortedCities = Array.from(new Set((Array.isArray(cities) ? cities : [])
    .map((city) => normalizeForKey(city))
    .filter(Boolean))).sort();
  return `${STORAGE_PREFIX}${normalizeForKey(country)}:${normalizeForKey(when)}:${normalizeForKey(category)}:${sortedCities.join("|")}`;
}

/**
 * Try to read a cached payload. Returns `{ payload, cachedAt }` on a fresh
 * hit, or `null` if the entry is missing, expired, corrupt, or the
 * localStorage backend is unavailable.
 */
export function readEventCache(key, now = Date.now()) {
  const storage = safeStorage();
  if (!storage) return null;
  let raw;
  try { raw = storage.getItem(key); } catch { return null; }
  if (!raw) return null;
  let entry;
  try { entry = JSON.parse(raw); } catch { return null; }
  if (!entry || typeof entry !== "object" || !entry.payload || typeof entry.cachedAt !== "number") return null;
  if (now - entry.cachedAt > TTL_MS) return null;
  return entry;
}

/**
 * Persist a payload. Skips writes for `providerStatus === "upstream_error"`
 * so transient errors never poison later sessions. Silently fails when
 * localStorage is unavailable or full.
 */
export function writeEventCache(key, payload, now = Date.now()) {
  if (!payload || typeof payload !== "object") return;
  // Skip errors: a 502 today shouldn't make tomorrow's modal show the same error.
  if (payload.providerStatus === "upstream_error") return;
  const storage = safeStorage();
  if (!storage) return;
  const entry = { cachedAt: now, payload };
  try { storage.setItem(key, JSON.stringify(entry)); } catch { /* quota or disabled */ }
}

/**
 * Remove a single cached entry — used by manual refresh.
 */
export function clearEventCache(key) {
  const storage = safeStorage();
  if (!storage) return;
  try { storage.removeItem(key); } catch { /* ignore */ }
}

/**
 * `true` if the cached entry is older than the configured TTL.
 * Useful for badge labels: "Cached · 2h ago · refresh".
 */
export function isEventCacheStale(entry, now = Date.now()) {
  if (!entry || typeof entry.cachedAt !== "number") return false;
  return now - entry.cachedAt > TTL_MS;
}

/**
 * Format the cache age in a human-friendly string ("just now", "12m ago",
 * "2h ago"). Used by the cache badge tooltip.
 */
export function formatEventCacheAge(cachedAtMs, now = Date.now()) {
  if (!cachedAtMs) return "";
  const delta = Math.max(0, now - cachedAtMs);
  const hours = Math.floor(delta / (60 * 60 * 1000));
  const minutes = Math.floor(delta / (60 * 1000));
  if (hours >= 1) return `${hours}h ago`;
  if (minutes >= 1) return `${minutes}m ago`;
  return "just now";
}

export const EVENT_CACHE_TTL_MS = TTL_MS;
