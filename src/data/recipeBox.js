// Recipe data is now served directly by the `recipe-search` Supabase Edge
// Function (which wraps Spoonacular's complex recipe search endpoint). The static seed
// recipes previously bundled here are gone — every recipe surfaced in
// FamOS suggestions, Cook Mode, and the meal editor comes from Spoonacular.
//
// This module is the home for the small utilities the Meals page still
// relies on: dietary-preference normalisation plus a search-body builder
// that turns a meal row into a clean Spoonacular query.

const normalizeRestriction = (entry) => String(entry || "").trim();

const CUISINE_VOCAB = [
  "Italian", "Mexican", "Indian", "Japanese", "Chinese", "Thai",
  "Mediterranean", "American Comfort", "Korean", "Vietnamese",
  "Middle Eastern", "Greek", "Spanish", "French",
];

export function normaliseDietaryPreferences(preferences) {
  const safe = preferences && typeof preferences === "object" ? preferences : {};
  const restrictions = Array.isArray(safe.restrictions)
    ? safe.restrictions.map(normalizeRestriction).filter(Boolean)
    : [];
  return {
    restrictions: [...new Set(restrictions)],
    avoidIngredients: String(safe.avoidIngredients || safe.avoid || "").trim(),
    notes: String(safe.notes || safe.dietaryNotes || "").trim(),
  };
}

// Roulette appends decorative suffixes (e.g. "Mexican breakfast pick") that
// wreck a recipe title search. Strip them so we query with the real
// cuisine + dish hint instead of a phrase that has no recipe.
const ROULETTE_SUFFIX_PATTERN = /\s+(pick|spin(?:ning)?|surprise(?:\s+me)?|try|lottery|draw|idea)\s*$/i;
const stripRouletteSuffix = (title) => String(title || "").replace(ROULETTE_SUFFIX_PATTERN, "").trim();

// Spoonacular accepts comma-separated real ingredients (e.g. "chicken,tomato,onion").
// Casual dish titles like "Sheet-pan chicken fajitas" do not contain an
// ingredient list, so we derive `ingredients` only when the user actually
// typed an explicit paste. The detector recognises any combination of
// commas / `+` / `&` / " and " / " with " — a phrase like "Chicken and rice"
// counts as a paste, while a clean dish title like "Sheet-pan chicken fajitas"
// or "Chicken parmesan" correctly returns false. We deliberately do NOT
// match bare ingredient keywords in casual titles; otherwise a dish named
// after an ingredient would be mis-classified as a paste.
const INGREDIENT_DELIMITER = /[+,&]|\s+and\s+|\s+with\s+/i;
const looksLikeIngredientPaste = (title) => {
  if (!title) return false;
  return INGREDIENT_DELIMITER.test(title);
};

// Builds the body for `supabase.functions.invoke("recipe-search", ...)`.
// Centralised so roulette/editor/Cook-Mode callers all use the same rules:
//   - roulette suffixes are stripped before searching
//   - Spoonacular's ingredient filter is only sent when the user typed
//     an explicit paste, so casual titles do not AND-filter to zero results
export function recipeSearchProfileForMeal(mealOrTitle = "", fallbackSlot = "dinner", dietaryPreferences = {}) {
  const title = typeof mealOrTitle === "string" ? mealOrTitle : mealOrTitle?.title || "";
  const slot = typeof mealOrTitle === "string" ? fallbackSlot : mealOrTitle?.slot || fallbackSlot;
  const stripped = stripRouletteSuffix(title);
  const cleanTitle = stripped.replace(/\s+/g, " ").trim();
  const ingredients = looksLikeIngredientPaste(stripped)
    ? stripped
        .split(INGREDIENT_DELIMITER)
        .map((part) => part.trim().toLowerCase())
        // Reject any "ingredient" that's actually multi-word — that's a phrase
        // like "Mexican breakfast" leaking through, not a real food item.
        .filter((part) => part && !/\s/.test(part))
        .slice(0, 6)
        .join(", ")
    : "";
  const diet = normaliseDietaryPreferences(dietaryPreferences);
  return {
    query: cleanTitle,
    ingredients,
    mealType: slot,
    dietary: diet.restrictions.join(" "),
    dietaryRestrictions: diet.restrictions,
    avoidIngredients: diet.avoidIngredients,
    dietaryNotes: diet.notes,
  };
}

// Returns an ordered list of search bodies to try. The first non-empty
// response wins. Each rung is a progressively looser Spoonacular match so a
// strict roulette title ("Mexican breakfast pick") still finds
// a recipe somewhere down the ladder rather than locking the user out of
// Cook Mode.
//
//   Rung 1: full cleaned title ("Mexican breakfast")
//   Rung 2: recognised cuisine alone ("Mexican")   — added only if the
//            cleaned title contains one of the supported cuisines
//   Rung 3: cuisine + slot ("Italian dinner")     — added only when a
//            cuisine is recognised AND the slot word is not already in
//            rung 1's query (otherwise rung 3 would duplicate rung 1
//            and waste one Spoonacular quota call per Cook tap)
//
// The bare slot fallback is intentionally omitted to avoid low-signal quota use.
export function buildCookSearchLadder(meal, dietaryPreferences = {}) {
  const stripped = stripRouletteSuffix(meal?.title || "");
  const cleanTitle = stripped.replace(/\s+/g, " ").trim();
  const slot = meal?.slot || "dinner";
  const cuisine = CUISINE_VOCAB.find((entry) => new RegExp(`\\b${entry}\\b`, "i").test(cleanTitle));
  const rungs = [
    recipeSearchProfileForMeal(meal, slot, dietaryPreferences),
  ];
  if (cuisine) {
    rungs.push({ ...recipeSearchProfileForMeal(cuisine, slot, dietaryPreferences), query: cuisine });
    if (!cleanTitle.toLowerCase().includes(slot.toLowerCase())) {
      rungs.push({ ...recipeSearchProfileForMeal(cuisine, slot, dietaryPreferences), query: `${cuisine} ${slot}` });
    }
  }
  // Fallback rungs for meals whose titles don't contain a recognised cuisine.
  // The ladder tries progressively broader matches so a strict title like
  // "Vegan Chocolate Cake" still has a chance of finding a recipe.
  if (!cuisine) {
    // Rung 2: try the title without mealType filtering so Spoonacular sees
    // the full query across all meal types instead of narrowing to one slot.
    const noType = { ...recipeSearchProfileForMeal(meal, slot, dietaryPreferences), query: cleanTitle };
    delete noType.mealType;
    rungs.push(noType);
    // Rung 3: extract key words from the title (skip short/common words)
    // and search by those ingredients. E.g. "Vegan Chocolate Cake" →
    // "chocolate, cake" which Spoonacular can match.
    const keywords = cleanTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3 && !/^(vegan?|with|and|from|the|for|style|easy|quick|best|homemade|fresh)$/i.test(word))
      .slice(0, 4);
    if (keywords.length > 1) {
      rungs.push({ query: "", ingredients: keywords.join(", "), mealType: slot, dietary: [] });
    }
  }
  // Discovery cards are intentionally lightweight. Cook Mode asks for one
  // expanded result so Spoonacular returns the full ingredients and steps.
  return rungs.map((rung) => ({ ...rung, details: true, number: 1 }));
}
