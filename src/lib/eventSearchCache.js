// localStorage cache for event-search responses.
// TTL: 4 hours. Key: country + when + dropdown category + sorted cities.
// Versioned prefix so future schema changes invalidate cleanly.
// Errors are never cached (only successful responses with results).

const CACHE_PREFIX_BASE = "famos_";
// v2 prefix: bumped when each event gained a `provider` field
// (SerpApi + Ticketmaster). Old v1 entries don't share the same storage
// prefix so reads ignore them naturally — no manual invalidation needed.
const STORAGE_PREFIX = "famos_event_search:v2:";
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
 *
 * `mutedNearbyCities` is folded into the key too so a different muted
 * selection hits a different cache entry. Without this, an old cached
 * response that included Toronto would still surface after the user muted
 * Toronto.
 */
export function eventCacheKey({ category, when, country, cities, mutedNearbyCities }) {
  const sortedCities = Array.from(new Set((Array.isArray(cities) ? cities : [])
    .map((city) => normalizeForKey(city))
    .filter(Boolean))).sort();
  const sortedMuted = Array.from(new Set((Array.isArray(mutedNearbyCities) ? mutedNearbyCities : [])
    .map((city) => normalizeForKey(city))
    .filter(Boolean))).sort();
  return `${STORAGE_PREFIX}${normalizeForKey(country)}:${normalizeForKey(when)}:${normalizeForKey(category)}:${sortedCities.join("|")}#m:${sortedMuted.join("|")}`;
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

/**
 * Count every `famos_*` localStorage entry without removing anything.
 * Used by Settings → Privacy to show a live "X cached entries" pill so the
 * user can see what the clear-all action will affect.
 */
export function countFamosCacheEntries() {
  const storage = safeStorage();
  if (!storage) return 0;
  let count = 0;
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(CACHE_PREFIX_BASE)) count += 1;
    }
  } catch { /* private mode / blocked storage */ }
  return count;
}

/**
 * Wipe every `famos_*` localStorage entry in one pass. Returns the number
 * of keys removed. Safe to call when localStorage is unavailable; returns
 * 0 in that case. Iterates in reverse so removals don't shift the live
 * enumeration out from under us.
 */
export function clearAllFamosCache() {
  const storage = safeStorage();
  if (!storage) return 0;
  let removed = 0;
  try {
    const targets = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(CACHE_PREFIX_BASE)) targets.push(key);
    }
    for (const key of targets) {
      storage.removeItem(key);
      removed += 1;
    }
  } catch { /* private mode / quota */ }
  return removed;
}
