// Recipe data is now served directly by the `recipe-search` Supabase Edge
// Function (which wraps the API Ninjas Recipe endpoint). The static seed
// recipes previously bundled here are gone — every recipe surfaced in
// FamOS suggestions, Cook Mode, and the meal editor comes from API Ninjas.
//
// This module remains as the home for the small set of utilities that the
// Meals page still relies on: roster dietary-preference normalisation. Any
// guards around static IDs, curated cuisine lists, or hardcoded ingredient
// lists are intentionally removed so the API-Ninjas sourcing rule is
// unambiguous for future contributors.

const normalizeRestriction = (entry) => String(entry || "").trim();

export function normaliseDietaryPreferences(preferences = {}) {
  const restrictions = Array.isArray(preferences.restrictions)
    ? preferences.restrictions.map(normalizeRestriction).filter(Boolean)
    : [];
  return {
    restrictions: [...new Set(restrictions)],
    avoidIngredients: String(preferences.avoidIngredients || preferences.avoid || "").trim(),
    notes: String(preferences.notes || preferences.dietaryNotes || "").trim(),
  };
}

// Builds the body for `supabase.functions.invoke("recipe-search", ...)`.
// Lifted out of the MealSuggestions component so the same query-string
// rules (meal type + cuisine + dietary filters + ingredient hints) apply
// everywhere recipes are surfaced.
export function recipeSearchProfileForMeal(mealOrTitle = "", fallbackSlot = "dinner", dietaryPreferences = {}) {
  const title = typeof mealOrTitle === "string" ? mealOrTitle : mealOrTitle?.title || "";
  const slot = typeof mealOrTitle === "string" ? fallbackSlot : mealOrTitle?.slot || fallbackSlot;
  const cleanTitle = String(title || "").replace(/\s+/g, " ").trim();
  const ingredients = cleanTitle
    .split(/[+,&]|\s+and\s+|\s+with\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join(", ");
  const diet = normaliseDietaryPreferences(dietaryPreferences);
  return {
    query: cleanTitle,
    ingredients,
    mealType: slot,
    dietary,
    dietaryRestrictions: diet.restrictions,
    avoidIngredients: diet.avoidIngredients,
    dietaryNotes: diet.notes,
  };
}
