// Recipe data is now served directly by the `recipe-search` Supabase Edge
// Function (which wraps the API Ninjas Recipe endpoint). The static seed
// recipes previously bundled here are gone — every recipe surfaced in
// FamOS suggestions, Cook Mode, and the meal editor comes from API Ninjas.
//
// This module is the home for the small utilities the Meals page still
// relies on: dietary-preference normalisation plus a search-body builder
// that turns a meal row into a clean API Ninjas query.

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
// wreck the API Ninjas title search. Strip them so we query with the real
// cuisine + dish hint instead of a phrase that has no recipe.
const ROULETTE_SUFFIX_PATTERN = /\s+(pick|spin(?:ning)?|surprise(?:\s+me)?|try|lottery|draw|idea)\s*$/i;
const stripRouletteSuffix = (title) => String(title || "").replace(ROULETTE_SUFFIX_PATTERN, "").trim();

// API Ninjas accepts comma-separated real ingredients (e.g. "chicken,tomato,onion").
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
//   - the API Ninjas `ingredients` filter is only sent when the user typed
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
// response wins. Each rung is a progressively looser match against API
// Ninjas so a strict roulette title ("Mexican breakfast pick") still finds
// a recipe somewhere down the ladder rather than locking the user out of
// Cook Mode.
//
//   Rung 1: full cleaned title ("Mexican breakfast")
//   Rung 2: recognised cuisine alone ("Mexican")   — added only if the
//            cleaned title contains one of the supported cuisines
//   Rung 3: cuisine + slot ("Italian dinner")     — added only when a
//            cuisine is recognised AND the slot word is not already in
//            rung 1's query (otherwise rung 3 would duplicate rung 1
//            and waste one API Ninjas free-tier call per Cook tap)
//
// The bare slot fallback ("breakfast"/"lunch"/"dinner") was tried and
// dropped: API Ninjas only has reliable coverage for the word "breakfast".
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
  return rungs;
}
