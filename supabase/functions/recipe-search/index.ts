// Spoonacular-backed recipe search. The API key stays in Supabase Edge
// Function secrets and is never included in the browser bundle.
// Docs: https://spoonacular.com/food-api/docs#Search-Recipes-Complex

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { consumeUsage, usageLimitResponse } from "../_shared/usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPOONACULAR_URL = "https://api.spoonacular.com/recipes/complexSearch";
const DEFAULT_SERVINGS = 4;
const DEFAULT_RESULT_LIMIT = 5;
const MAX_RESULT_LIMIT = 5;
const cleanText = (input = "", maxLength = 200) => String(input || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);

const cleanIngredients = (raw) => Array.isArray(raw)
  ? raw.map((entry) => {
      if (!entry) return null;
      if (typeof entry === "string") return { name: cleanText(entry, 100), quantity: null, unit: "" };
      const name = cleanText(entry.name || entry.originalName || entry.ingredient || "", 100);
      const amount = Number(entry.amount ?? entry.quantity);
      return name ? { name, quantity: Number.isFinite(amount) && amount > 0 ? amount : null, unit: cleanText(entry.unit || "", 24) } : null;
    }).filter(Boolean).slice(0, 30)
  : [];

const cleanInstructions = (payload) => {
  const analyzed = Array.isArray(payload?.analyzedInstructions) ? payload.analyzedInstructions : [];
  const steps = analyzed.flatMap((section) => Array.isArray(section?.steps) ? section.steps : []).map((step) => cleanText(step?.step, 500)).filter(Boolean);
  if (steps.length) return steps.slice(0, 20);
  const plain = cleanText(payload?.instructions || "", 5000);
  return plain ? plain.split(/(?<=[.!?])\s+(?=[A-Z])/).map((step) => cleanText(step, 500)).filter((step) => step.length > 4).slice(0, 20) : [];
};

const normaliseRecipe = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  const title = cleanText(payload.title, 140);
  if (!title) return null;
  const servings = Number(payload.servings);
  const ready = Number(payload.readyInMinutes);
  return {
    id: payload.id ? String(payload.id) : title.toLowerCase().replace(/\W+/g, "-").slice(0, 80),
    title,
    ingredients: cleanIngredients(payload.extendedIngredients),
    instructions: cleanInstructions(payload),
    servings: Number.isFinite(servings) && servings > 0 ? Math.round(servings) : DEFAULT_SERVINGS,
    readyInMinutes: Number.isFinite(ready) && ready > 0 ? Math.round(ready) : null,
    cuisine: cleanText(payload.cuisines?.[0] || payload.dishTypes?.[0] || "", 60),
    thumbnail: cleanText(payload.image || "", 500),
    videoUrl: cleanText(payload.videoUrl || "", 500),
    source: cleanText(payload.creditsText || "Spoonacular", 100),
    sourceUrl: cleanText(payload.sourceUrl || payload.spoonacularSourceUrl || "", 500),
    usedIngredientCount: Number(payload.usedIngredientCount || 0),
    missedIngredientCount: Number(payload.missedIngredientCount || 0),
    usedIngredients: cleanIngredients(payload.usedIngredients),
    missedIngredients: cleanIngredients(payload.missedIngredients),
  };
};
const isCookableRecipe = (recipe) => Boolean(recipe?.title && recipe?.ingredients?.length && recipe?.instructions?.length);

const DIET_MAP = new Map([
  ["vegetarian", "vegetarian"], ["vegan", "vegan"], ["pescatarian", "pescetarian"],
  ["gluten-free", "gluten free"], ["gluten free", "gluten free"],
]);
const INTOLERANCE_MAP = new Map([
  ["dairy-free", "dairy"], ["dairy free", "dairy"], ["gluten-free", "gluten"], ["gluten free", "gluten"],
  ["nut-free", "tree nut,peanut"], ["nut free", "tree nut,peanut"], ["shellfish-free", "shellfish"], ["shellfish free", "shellfish"],
]);

const buildSearchParams = ({ query = "", ingredients = "", cuisine = "", mealType = "", offset = 0, number = DEFAULT_RESULT_LIMIT, details = false, dietaryRestrictions = [], avoidIngredients = "" } = {}) => {
  const params = new URLSearchParams();
  const cleanQuery = cleanText(query, 200);
  const cleanIngredientList = cleanText(ingredients, 300);
  if (cleanQuery) params.set("query", cleanQuery);
  if (cleanIngredientList) params.set("includeIngredients", cleanIngredientList);
  if (cuisine) params.set("cuisine", cleanText(cuisine, 60));
  const restrictions = Array.isArray(dietaryRestrictions) ? dietaryRestrictions.map((item) => cleanText(item, 40).toLowerCase()) : [];
  const diets = [...new Set(restrictions.map((item) => DIET_MAP.get(item)).filter(Boolean))];
  const intolerances = [...new Set(restrictions.flatMap((item) => (INTOLERANCE_MAP.get(item) || "").split(",")).filter(Boolean))];
  if (diets.length) params.set("diet", diets.join(","));
  if (intolerances.length) params.set("intolerances", intolerances.join(","));
  if (avoidIngredients) params.set("excludeIngredients", cleanText(avoidIngredients, 200));
  // Spoonacular's complexSearch only accepts a fixed set of meal types
  // (breakfast, main course, side dish, …). "lunch" is not one of them, so
  // map breakfast/lunch/dinner slots onto valid values.
  if (mealType) {
    const spoonacularType = { breakfast: "breakfast", lunch: "main course", dinner: "main course" }[cleanText(mealType, 40)];
    if (spoonacularType) params.set("type", spoonacularType);
  }
  const safeOffset = Math.min(Math.max(Math.trunc(Number(offset) || 0), 0), 900);
  const safeNumber = Math.min(Math.max(Math.trunc(Number(number) || DEFAULT_RESULT_LIMIT), 1), MAX_RESULT_LIMIT);
  if (safeOffset) params.set("offset", String(safeOffset));
  params.set("instructionsRequired", "true");
  // Suggestions must be Cook Mode-ready before the user can plan them. Asking
  // for full information here costs more quota than title-only discovery, but
  // prevents dead-end recipes with no ingredients or usable steps.
  params.set("addRecipeInformation", "true");
  params.set("addRecipeInstructions", "true");
  params.set("fillIngredients", "true");
  if (cleanIngredientList && !details) {
    params.set("sort", "max-used-ingredients");
    params.set("ignorePantry", "true");
  }
  params.set("number", String(safeNumber));
  return params;
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const usage = await consumeUsage(request, "premium_api_operations");
    if (!usage.allowed) return usageLimitResponse(usage, corsHeaders);
    const apiKey = Deno.env.get("SPOONACULAR_API_KEY");
    if (!apiKey) return json({ error: "Spoonacular is not configured yet. Set SPOONACULAR_API_KEY in Supabase Edge Function Secrets.", recipes: [] }, 400);
    const body = await request.json().catch(() => ({}));
    const searchParams = buildSearchParams(body || {});
    if (!searchParams.get("query") && !searchParams.get("includeIngredients") && !searchParams.get("type")) return json({ error: "Choose a meal type, recipe name, or ingredient so we can find recipes.", recipes: [] }, 400);
    const response = await fetch(`${SPOONACULAR_URL}?${searchParams}`, { method: "GET", headers: { "x-api-key": apiKey, Accept: "application/json" } });
    if (!response.ok) {
      const detail = cleanText(await response.text().catch(() => ""), 300);
      if (response.status === 402 || response.status === 429) return json({ error: "Spoonacular quota reached. Try again later.", recipes: [] }, 429);
      return json({ error: `Spoonacular request failed (${response.status}). ${detail}`.trim(), recipes: [] }, 502);
    }
    const raw = await response.json().catch(() => null);
    const recipes = (Array.isArray(raw?.results) ? raw.results : []).map(normaliseRecipe).filter(isCookableRecipe);
    return json({
      recipes,
      query: searchParams.get("query") || "",
      source: "spoonacular",
      offset: Number(raw?.offset ?? searchParams.get("offset") ?? 0),
      number: Number(raw?.number ?? searchParams.get("number") ?? recipes.length),
      totalResults: Number(raw?.totalResults ?? recipes.length), usage,
    });
  } catch (error) {
    console.error("recipe-search failed", error);
    return json({ error: error?.message || "Recipe lookup failed.", recipes: [] }, 400);
  }
});
