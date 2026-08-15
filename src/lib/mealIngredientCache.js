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

// Recipe APIs often return display-ready ingredient lines ("1/2 cup sliced
// mushrooms") while the grocery list stores purchasable items ("mushrooms").
// Reduce those lines to stable item names before comparing, counting or adding.
export function canonicalIngredientName(value) {
  let name = String(value || "")
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return "";

  name = name
    // Leading quantities: 2, 1/2, 1 1/2, ½, 2-3.
    .replace(/^(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*/i, "")
    // Common recipe measures and container words.
    .replace(/^(?:(?:fl\.?\s*)?(?:oz|ounce|ounces)|lb|lbs|pound|pounds|g|gram|grams|kg|kilogram|kilograms|ml|milliliter|milliliters|l|liter|liters|tsp|teaspoon|teaspoons|tbsp|tbs|tablespoon|tablespoons|cup|cups|pinch|pinches|dash|dashes|clove|cloves|can|cans|package|packages|pkg|bunch|bunches|slice|slices|piece|pieces)\b\.?\s*(?:of\s+)?/i, "")
    // Preparation belongs in the recipe, not in the shopping-list item name.
    .replace(/^(?:finely\s+|roughly\s+)?(?:chopped|diced|minced|sliced|shredded|grated|crushed|ground|fresh|frozen|melted|softened|cooked|uncooked)\s+/i, "")
    .replace(/\s*,.*$/, "")
    .replace(/\s+(?:to taste|as needed|for serving|divided)$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return name;
}

// Returns true when a single ingredient name is already covered by the
// household's current grocery list. Quantities and recipe preparation text
// are intentionally ignored: "1 cup mushrooms" is covered by "mushrooms".
export function isIngredientOnList(name, groceries) {
  const target = canonicalIngredientName(name);
  if (!target) return false;
  return groceries.some((grocery) => canonicalIngredientName(grocery?.name) === target);
}
