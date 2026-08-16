import { invokeEdgeFunction } from "./supabase";

// v2 only stores the post-August-2026 cookable contract: every recipe has
// both ingredients and usable step-by-step instructions.
const CACHE_KEY = "famos:recipe-search-cache:v2";
const FRESH_FOR_MS = 12 * 60 * 60 * 1000;
const STALE_FOR_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 40;
const pending = new Map();

const normalizedPayload = (payload = {}) => Object.fromEntries(
  Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => [key, Array.isArray(value) ? [...value].sort() : value])
    .sort(([a], [b]) => a.localeCompare(b)),
);

const readCache = () => {
  try { return JSON.parse(window.localStorage.getItem(CACHE_KEY) || "{}"); }
  catch { return {}; }
};

const writeCache = (cache) => {
  try {
    const trimmed = Object.fromEntries(Object.entries(cache).sort(([, a], [, b]) => b.savedAt - a.savedAt).slice(0, MAX_ENTRIES));
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
  } catch { /* private mode and storage pressure must not block recipes */ }
};

const dietSignature = (payload = {}) => JSON.stringify({
  restrictions: [...(payload.dietaryRestrictions || [])].map(String).sort(),
  avoid: String(payload.avoidIngredients || "").trim().toLowerCase(),
});

const cachedFallback = (cache, payload, now) => {
  const signature = dietSignature(payload);
  const candidates = Object.values(cache)
    .filter((entry) => now - entry.savedAt <= STALE_FOR_MS)
    .filter((entry) => entry.mealType === payload.mealType && entry.dietSignature === signature)
    .sort((a, b) => b.savedAt - a.savedAt);
  const recipes = [];
  const seen = new Set();
  for (const entry of candidates) {
    for (const recipe of entry.data?.recipes || []) {
      const id = String(recipe.id || recipe.title || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      recipes.push(recipe);
      if (recipes.length === 3) return { recipes, source: "cache", cached: true, providerLimited: true };
    }
  }
  return recipes.length ? { recipes, source: "cache", cached: true, providerLimited: true } : null;
};

export async function searchRecipes(payload = {}, { force = false } = {}) {
  const request = normalizedPayload(payload);
  const key = JSON.stringify(request);
  const cache = readCache();
  const now = Date.now();
  const exact = cache[key];
  if (!force && exact && now - exact.savedAt <= FRESH_FOR_MS) return { ...exact.data, cached: true };
  if (pending.has(key)) return pending.get(key);

  const operation = invokeEdgeFunction("recipe-search", request)
    .then((data) => {
      if (Array.isArray(data?.recipes) && data.recipes.length) {
        cache[key] = { data, savedAt: now, mealType: request.mealType || "", dietSignature: dietSignature(request) };
        writeCache(cache);
      }
      return data;
    })
    .catch((error) => {
      if (/quota|429|402/i.test(error?.message || "")) {
        const fallback = exact && now - exact.savedAt <= STALE_FOR_MS
          ? { ...exact.data, cached: true, providerLimited: true }
          : cachedFallback(cache, request, now);
        if (fallback) return fallback;
      }
      throw error;
    })
    .finally(() => pending.delete(key));
  pending.set(key, operation);
  return operation;
}
