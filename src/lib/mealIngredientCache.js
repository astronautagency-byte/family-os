// Shared cache for meal → [ingredient names] mappings. Both Meals.jsx (which
// writes the cache after a recipe lookup) and Groceries.jsx (which reads it
// to power the "What's missing for what's planned?" cross-reference) use
// this single localStorage key + parser.
//
// The cache shape is `{ [mealId: string]: string[] }` where the strings are
// already lowercased + trimmed. The same set of consumers write and read
// from the same key, so a stale shape only happens if a future contributor
// changes the shape — handle that with a try/catch on read.

export const INGREDIENT_CACHE_KEY = "famos:meal-ingredients:v1";

export function loadIngredientCache() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(INGREDIENT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveIngredientCache(cache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INGREDIENT_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable (private mode / quota) */
  }
  // Notify same-tab listeners so Meals.jsx (writer) and Groceries.jsx
  // (reader) stay in sync without a reload. Cross-tab sync rides the
  // native 'storage' event automatically. Both surfaces are part of the
  // SPA, so the dispatch is what keeps a Cook Mode lookup in another
  // tab of the same app updating the missing-by-meal surface.
  try {
    window.dispatchEvent(new CustomEvent("famos:meal-ingredients-changed"));
  } catch {
    /* CustomEvent polyfill gap — private browsing or older edge cases */
  }
}

// Returns true when a single ingredient name is already covered by the
// household's current grocery list — strict lowercase equality, matches
// `.meal-grocery-badge` on Meals.jsx so the two surfaces never disagree.
export function isIngredientOnList(name, groceries) {
  const target = String(name || "").trim().toLowerCase();
  if (!target) return false;
  return groceries.some((grocery) => String(grocery?.name || "").trim().toLowerCase() === target);
}
