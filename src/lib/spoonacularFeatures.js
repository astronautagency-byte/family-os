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
