import { invokeEdgeFunction } from "./supabase";

/**
 * Get recipe cost breakdown from Spoonacular.
 * @param {string} recipeId - The Spoonacular recipe ID
 * @returns {Promise<{totalCost: number, totalCostPerServing: number, ingredients: Array}>}
 */
export async function getRecipeCost(recipeId) {
  if (!recipeId) throw new Error("Recipe ID is required.");
  try {
    const data = await invokeEdgeFunction("recipe-cost", { recipeId: String(recipeId) });
    return {
      totalCost: Number(data.totalCost) || 0,
      totalCostPerServing: Number(data.totalCostPerServing) || 0,
      currency: data.currency || "USD",
      ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    };
  } catch (error) {
    // Gracefully handle quota limits and errors
    if (error?.message?.includes("quota") || error?.status === 429) {
      return null;
    }
    console.warn("Could not fetch recipe cost:", error);
    return null;
  }
}

/**
 * Get ingredient substitutes from Spoonacular.
 * @param {string} ingredientName - The ingredient to find substitutes for
 * @param {number} [ingredientId] - Optional Spoonacular ingredient ID
 * @returns {Promise<{ingredient: string, substitutes: string[], message: string}>}
 */
export async function getIngredientSubstitutes(ingredientName, ingredientId) {
  if (!ingredientName) throw new Error("Ingredient name is required.");
  try {
    const data = await invokeEdgeFunction("ingredient-substitutes", {
      ingredientName,
      ingredientId: ingredientId || undefined,
    });
    return {
      ingredient: data.ingredient || ingredientName,
      substitutes: Array.isArray(data.substitutes) ? data.substitutes : [],
      message: data.message || "",
    };
  } catch (error) {
    if (error?.message?.includes("quota") || error?.status === 429) {
      return { ingredient: ingredientName, substitutes: [], message: "Quota reached. Try again later." };
    }
    console.warn("Could not fetch ingredient substitutes:", error);
    return { ingredient: ingredientName, substitutes: [], message: "Could not find substitutes." };
  }
}

/**
 * Format a cost value as USD currency string.
 * @param {number} cents - Cost in cents
 * @returns {string}
 */
export function formatCost(cents) {
  if (!cents || cents <= 0) return "";
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

/**
 * Get nutrition info for a recipe from Spoonacular.
 * @param {string} recipeId - The Spoonacular recipe ID
 * @returns {Promise<{calories: number, protein: number, carbs: number, fat: number, fiber: number, sugar: number} | null>}
 */
export async function getRecipeNutrition(recipeOrId, recipe = null) {
  const selected = recipe && typeof recipe === "object" ? recipe : typeof recipeOrId === "object" ? recipeOrId : null;
  const recipeId = selected?.id || (typeof recipeOrId === "string" || typeof recipeOrId === "number" ? recipeOrId : null);
  const ingredients = Array.isArray(selected?.ingredients) ? selected.ingredients : [];
  if (!recipeId || !ingredients.length) return null;
  try {
    const data = await invokeEdgeFunction("recipe-nutrition", {
      title: selected?.title || "Recipe",
      servings: selected?.servings || 4,
      ingredients,
    });
    if (!data?.totals) return null;
    return {
      calories: Number(data.totals.calories) || 0,
      protein: Number(data.totals.protein_g) || 0,
      carbs: Number(data.totals.carbohydrates_total_g) || 0,
      fat: Number(data.totals.fat_total_g) || 0,
      fiber: Number(data.totals.fiber_g) || 0,
      sugar: Number(data.totals.sugar_g) || 0,
    };
  } catch (error) {
    if (error?.message?.includes("quota") || error?.status === 429) return null;
    console.warn("Could not fetch nutrition:", error);
    return null;
  }
}

/**
 * Get similar recipes from Spoonacular.
 * @param {string} recipeId - The Spoonacular recipe ID
 * @param {number} [number=6] - Number of similar recipes to return
 * @returns {Promise<Array<{id: string, title: string, image: string, readyInMinutes: number}>>}
 */
export async function getSimilarRecipes(recipeId, number = 6) {
  if (!recipeId) return [];
  try {
    const data = await invokeEdgeFunction("recipe-similar", { recipeId: String(recipeId), number });
    return Array.isArray(data?.recipes) ? data.recipes : [];
  } catch (error) {
    if (error?.message?.includes("quota") || error?.status === 429) return [];
    console.warn("Could not fetch similar recipes:", error);
    return [];
  }
}
