// Spoonacular ingredient substitutes lookup.
// Finds alternative ingredients when you don't have something on hand.
// Docs: https://spoonacular.com/food-api/docs#Get-Ingredient-Substitutes

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { consumeUsage, usageLimitResponse } from "../_shared/usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPOONACULAR_BASE = "https://api.spoonacular.com";
const cleanText = (input = "", maxLength = 200) => String(input || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Spoonacular ingredient ID mapping for common ingredients
const INGREDIENT_IDS = new Map([
  ["butter", 1001], ["milk", 1077], ["eggs", 1123], ["flour", 20081],
  ["sugar", 19335], ["salt", 2047], ["olive oil", 1014014], ["garlic", 11215],
  ["onion", 11282], ["chicken", 5006], ["beef", 23572], ["pork", 1001028],
  ["salmon", 15076], ["tomatoes", 11529], ["potatoes", 11352], ["carrots", 11124],
  ["broccoli", 11090], ["spinach", 10011457], ["cheese", 1040], ["cream", 1053],
  ["yogurt", 1116], ["bread", 18064], ["rice", 20044], ["pasta", 20420],
  ["lemon", 9150], ["lime", 9160], ["apple", 9003], ["banana", 9011],
  ["chicken broth", 6194], ["soy sauce", 16124], ["honey", 19296],
  ["maple syrup", 19354], ["vinegar", 2048], ["mustard", 2046],
  ["mayonnaise", 4025], ["ketchup", 11935], ["pepper", 1002030],
  ["cinnamon", 2010], ["ginger", 11216], ["basil", 2044], ["oregano", 1022027],
  ["thyme", 2049], ["parsley", 11297], ["cilantro", 11165], ["rosemary", 1082027],
]);

function findIngredientId(name) {
  const normalized = name.toLowerCase().trim();
  if (INGREDIENT_IDS.has(normalized)) return INGREDIENT_IDS.get(normalized);
  for (const [key, id] of INGREDIENT_IDS) {
    if (normalized.includes(key) || key.includes(normalized)) return id;
  }
  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const usage = await consumeUsage(request, "premium_api_operations");
    if (!usage.allowed) return usageLimitResponse(usage, corsHeaders);

    const apiKey = Deno.env.get("SPOONACULAR_API_KEY");
    if (!apiKey) return json({ error: "Spoonacular is not configured yet." }, 400);

    const { ingredientName, ingredientId } = await request.json().catch(() => ({}));
    const resolvedId = ingredientId || findIngredientId(ingredientName);
    if (!resolvedId) return json({ error: `Could not find substitutes for "${ingredientName}". Try a different ingredient.` }, 400);

    const response = await fetch(`${SPOONACULAR_BASE}/food/ingredients/${resolvedId}/substitutes`, {
      method: "GET",
      headers: { "x-api-key": apiKey, Accept: "application/json" },
    });

    if (!response.ok) {
      if (response.status === 402 || response.status === 429) return json({ error: "Spoonacular quota reached." }, 429);
      return json({ error: `Spoonacular request failed (${response.status}).` }, 502);
    }

    const raw = await response.json().catch(() => null);
    if (!raw) return json({ error: "Could not parse substitute data." }, 502);

    const substitutes = (Array.isArray(raw.substitutes) ? raw.substitutes : []).map((item) => cleanText(item, 200));

    return json({
      ingredient: cleanText(raw.ingredient || ingredientName, 100),
      substitutes,
      message: cleanText(raw.message || "", 500),
      usage,
    });
  } catch (error) {
    console.error("ingredient-substitutes failed", error);
    return json({ error: error?.message || "Substitute lookup failed." }, 400);
  }
});
