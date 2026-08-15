// Recipe nutrition via Spoonacular Analyze Recipe. The shared Spoonacular
// secret stays server-side. Docs: https://spoonacular.com/food-api/docs#Analyze-Recipe

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const API_URL = "https://api.spoonacular.com/recipes/analyze";
const clean = (value = "", max = 180) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ingredientLine = (item) => {
  if (typeof item === "string") return clean(item);
  if (!item || typeof item !== "object") return "";
  return clean([item.quantity, item.unit, item.name].filter(Boolean).join(" "));
};

const nutrientAmount = (nutrients, name) => {
  const item = nutrients.find((entry) => String(entry?.name || "").toLowerCase() === name.toLowerCase());
  const amount = Number(item?.amount);
  return Number.isFinite(amount) ? Math.round(amount * 10) / 10 : 0;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("SPOONACULAR_API_KEY");
    if (!apiKey) return json({ error: "Spoonacular is not configured. Set SPOONACULAR_API_KEY in Supabase Edge Function Secrets.", items: [] }, 400);
    const body = await request.json().catch(() => ({}));
    const lines = Array.isArray(body?.ingredients) ? body.ingredients.map(ingredientLine).filter(Boolean).slice(0, 40) : [];
    if (!lines.length && body?.query) lines.push(...String(body.query).split(",").map((item) => clean(item)).filter(Boolean).slice(0, 40));
    if (!lines.length) return json({ error: "Provide an ingredient list to get nutrition data.", items: [] }, 400);

    const response = await fetch(`${API_URL}?includeNutrition=true&includeTaste=false`, {
      method: "POST",
      headers: { "x-api-key": apiKey, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ title: clean(body?.title || "FamOS recipe", 120), servings: Number(body?.servings) || 4, ingredients: lines, instructions: "" }),
    });
    if (!response.ok) {
      const detail = clean(await response.text().catch(() => ""), 300);
      if (response.status === 402 || response.status === 429) return json({ error: "Spoonacular quota reached. Try again later.", items: [] }, 429);
      return json({ error: `Spoonacular nutrition request failed (${response.status}). ${detail}`.trim(), items: [] }, 502);
    }
    const raw = await response.json().catch(() => null);
    const nutrients = Array.isArray(raw?.nutrition?.nutrients) ? raw.nutrition.nutrients : [];
    const totals = nutrients.length ? {
      calories: nutrientAmount(nutrients, "Calories"),
      protein_g: nutrientAmount(nutrients, "Protein"),
      carbohydrates_total_g: nutrientAmount(nutrients, "Carbohydrates"),
      fat_total_g: nutrientAmount(nutrients, "Fat"),
      fat_saturated_g: nutrientAmount(nutrients, "Saturated Fat"),
      fiber_g: nutrientAmount(nutrients, "Fiber"),
      sugar_g: nutrientAmount(nutrients, "Sugar"),
      sodium_mg: nutrientAmount(nutrients, "Sodium"),
    } : null;
    return json({ items: nutrients, totals, query: lines.join(", "), source: "spoonacular" });
  } catch (error) {
    console.error("recipe-nutrition failed", error);
    return json({ error: error?.message || "Nutrition lookup failed.", items: [] }, 400);
  }
});
