// Recipe nutrition backed by API Ninjas (`/v1/nutrition`). Takes a recipe's
// ingredient list as a free-text query and returns a per-ingredient nutritional
// breakdown (calories, macros, micros). Shares the same API key secret as the
// sibling `recipe-search` function.
//
// API docs: https://api-ninjas.com/api/nutrition
//
// Response shape: a JSON array where each element corresponds to one food item
// parsed from the query:
//   { serving_size_g, calories, fat_total_g, fat_saturated_g, protein_g,
//     sodium_mg, potassium_mg, cholesterol_mg, carbohydrates_total_g,
//     fiber_g, sugar_g }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_URL = "https://api.api-ninjas.com/v1/nutrition";

const sumField = (data, field) => {
  let sum = 0;
  for (const item of data) {
    const val = Number(item[field]);
    if (Number.isFinite(val)) sum += val;
  }
  return Math.round(sum * 10) / 10;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RECIPE_API_NINJAS_KEY") || Deno.env.get("API_NINJAS_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API Ninjas is not configured. Set RECIPE_API_NINJAS_KEY in Supabase Edge Function Secrets." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { query, ingredients } = body || {};

    // Build a free-text query from the ingredient list. The API Ninjas Nutrition
    // endpoint accepts natural language descriptions like "2 cups flour, 3 eggs,
    // 1 cup sugar".
    let queryText = String(query || "").trim();
    if (!queryText && Array.isArray(ingredients)) {
      queryText = ingredients
        .map((item) => {
          if (typeof item === "string") return item.trim();
          if (item && typeof item === "object") {
            const parts = [];
            if (item.quantity) parts.push(item.quantity);
            if (item.unit) parts.push(item.unit);
            if (item.name) parts.push(item.name);
            return parts.join(" ");
          }
          return "";
        })
        .filter(Boolean)
        .join(", ");
    }
    if (!queryText) {
      return new Response(
        JSON.stringify({ error: "Provide a query string or ingredient list to get nutrition data.", items: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = `${API_URL}?query=${encodeURIComponent(queryText)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "API Ninjas rate limit reached. Try again in a few minutes.", items: [] }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      let detail = "";
      try { detail = (await response.text()).slice(0, 300); } catch { /* ignore */ }
      return new Response(
        JSON.stringify({ error: `Nutrition API request failed (${response.status}). ${detail}`.trim() }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const raw = await response.json().catch(() => null);
    const items = Array.isArray(raw) ? raw : [];

    // Compute per-recipe totals from individual ingredient nutritional data.
    const totals = items.length
      ? {
          calories: sumField(items, "calories"),
          protein_g: sumField(items, "protein_g"),
          carbohydrates_total_g: sumField(items, "carbohydrates_total_g"),
          fat_total_g: sumField(items, "fat_total_g"),
          fat_saturated_g: sumField(items, "fat_saturated_g"),
          fiber_g: sumField(items, "fiber_g"),
          sugar_g: sumField(items, "sugar_g"),
          sodium_mg: sumField(items, "sodium_mg"),
        }
      : null;

    return new Response(
      JSON.stringify({ items, totals, query: queryText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("recipe-nutrition failed", error);
    return new Response(
      JSON.stringify({ error: error.message || "Nutrition lookup failed.", items: [] }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
