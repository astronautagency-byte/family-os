// Cookable-tonight: every recipe ingredient matches a CHECKED grocery by
// name. Used to power a soft-tier "you can make this now" surface in the
// Meals and FamAI suggestion flows, mirroring the muted-events soft-tier
// pattern from Calendar.jsx.
//
// Matching is intentionally fuzzy at the token level because API Ninjas
// returns ingredient strings like "1 lb ground beef (chopped)" while
// groceries are bare names like "ground beef". A token-based substring
// check (length ≥ 3) handles these cases without false negatives on the
// common patterns. The abbrev token filter drops pure numbers and
// short prepositions that match too liberally.

// Tokenise an ingredient string into comparable form.
// "1 lb ground beef (chopped)" → ["ground", "beef"]
// "200g flour"               → ["flour"]
// "Salt and pepper to taste" → ["salt", "pepper", "taste"]
const normaliseIngredient = (raw) => {
  const text = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return [];
  // Drop pure-numeric / short-alpha tokens like "200g" or "lb" — they
  // can't usefully disambiguate an ingredient (substring "200g" has no
  // business matching a real grocery name). Keep tokens whose alphabetic
  // portion is at least 3 characters.
  return text.split(" ").filter((token) => token.replace(/[^a-z]/g, "").length >= 3);
};

// True when ANY token of the ingredient is a substring of the grocery
// name. Token "ground" matches grocery "ground beef"; token "beef"
// also matches. Single-token ingredient (e.g. "flour") matches grocery
// "all-purpose flour". Multi-token grocery names (e.g. "extra virgin
// olive oil") require at least one token to land.
const ingredientMatchesGrocery = (tokens, groceryName) => {
  const gname = String(groceryName || "").toLowerCase().trim();
  if (!gname || !tokens.length) return false;
  return tokens.some((token) => gname.includes(token));
};

// Soft-tier rule: every ingredient has at least one matching CHECKED
// grocery. Returns false when:
//   - recipe has no ingredients (cached but not yet populated)
//   - the household has zero checked groceries (nobody's cooked yet)
//   - any ingredient fails to match a checked grocery
//
// Edge case — the short-circuit on empty-token ingredients (return
// true for that ingredient) covers inputs that normalise to NOTHING
// after the alpha-only filter: empty strings, pure punctuation
// ("!!!" → ""), pure digits ("200" → ""), and the like. Note: "to
// taste" actually produces ["taste"] (length 1 token above the
// 3-alpha threshold filters in "to" but keeps "taste"), so it goes
// through the normal token-matching flow, not the short-circuit. The
// short-circuit is therefore extremely narrow in practice — but it's
// the kind thing that's easy to break in a refactor without realising,
// so the JSDoc is explicit.
export const isCookableTonight = (recipe, groceries = []) => {
  if (!recipe || !Array.isArray(recipe.ingredients) || !recipe.ingredients.length) return false;
  const checkedNames = groceries
    .filter((g) => g && g.checked && typeof g.name === "string" && g.name.trim().length > 0)
    .map((g) => g.name);
  if (!checkedNames.length) return false;
  return recipe.ingredients.every((ingredient) => {
    const tokens = normaliseIngredient(ingredient);
    if (!tokens.length) return true;
    return tokens.some((token) => checkedNames.some((name) => name.toLowerCase().includes(token)));
  });
};

// Convenience: subset of recipes the user can cook tonight.
export const cookableRecipes = (recipes, groceries = []) =>
  (Array.isArray(recipes) ? recipes : []).filter((recipe) => isCookableTonight(recipe, groceries));
