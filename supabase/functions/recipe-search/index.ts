// Recipe search backed entirely by API Ninjas (`https://api-ninjas.com/api/recipe`).
// Strict sourcing: every recipe surfaced here comes from API Ninjas. The cached
// fallback list in `src/data/recipeBox.js` is no longer used for suggestions or
// cook mode — only its utility helpers (`normaliseDietaryPreferences`,
// `recipeSearchProfileForMeal`) remain in the data layer.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_NINJAS_URL = "https://api.api-ninjas.com/v1/recipe";
const API_NINJAS_SOURCE = "https://api-ninjas.com/api/recipe";

const cleanText = (input = "", maxLength = 200) =>
  String(input || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

// API Ninjas returns `ingredients` as a single newline-separated string.
// Split on common separators so the UI can render each item on its own row.
const cleanIngredients = (raw = "") =>
  String(raw || "")
    .replace(/\r/g, "")
    .split(/\n|·|•|;|\||(?<=\.)\s+/)
    .map((line) => line.trim().replace(/^[-*•\s]+/, ""))
    .filter((line) => line.length > 1)
    .slice(0, 20);

// API Ninjas returns `instructions` as a single string blob. Most entries use
// the shape "1. Do X\n2. Do Y" or "Step 1: …\nStep 2: …" but some are a long
// paragraph. Normalise into at least one short, parsed step per line; if the
// payload is a single paragraph, chunk it into paired sentences so the
// cook-mode walkthrough stays scannable.
const cleanInstructions = (raw = "") => {
  const text = String(raw || "").replace(/\r/g, "").trim();
  if (!text) return [];

  const byNewline = text
    .split(/\n+/)
    .map((line) =>
      line
        .trim()
        .replace(/^\d+[\.\)]\s*/, "")
        .replace(/^step\s*\d+\s*[:\-–]?\s*/i, "")
        .replace(/^[-*•]\s*/, "")
    )
    .filter((line) => line.length > 4);

  if (byNewline.length > 1) return byNewline.slice(0, 12);

  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const chunks = [];
  for (let i = 0; i < sentences.length && chunks.length < 12; i += 2) {
    const joined = sentences.slice(i, i + 2).join(" ").trim();
    if (joined && joined.length > 4) chunks.push(joined);
  }
  return chunks.length ? chunks : [text];
};

// API Ninjas only accepts a single free-text `query` parameter. Stitch every
// caller-supplied bit of context into a single search string so families get
// relevant hits without losing their filters.
const buildQuery = ({ query = "", ingredients = "", mealType = "", cuisine = "", dietary = "" } = {}) => {
  const pieces = [mealType, cuisine, dietary, ingredients, query]
    .map((field) => cleanText(field, 80))
    .filter(Boolean);
  return pieces.join(" ").trim().slice(0, 200);
};

const normaliseRecipe = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  const title = cleanText(payload.title, 120);
  if (!title) return null;
  return {
    title,
    ingredients: cleanIngredients(payload.ingredients),
    servings: Number(payload.servings) || 4,
    cuisine: cleanText(payload.cuisine || "Family favourite", 60),
    readyInMinutes: Number(payload.readyInMinutes || payload.total_time || payload.totalTime || 35) || 35,
    instructions: cleanInstructions(payload.instructions),
    sourceUrl: API_NINJAS_SOURCE,
    source: "API Ninjas",
  };
};

const apiError = async (response) => {
  if (response.status === 429) {
    return new Response(
      JSON.stringify({ error: "API Ninjas rate limit reached. Try again in a few minutes.", recipes: [] }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  let detail = "";
  try {
    detail = (await response.text()).slice(0, 300);
  } catch {
    detail = "";
  }
  return new Response(
    JSON.stringify({ error: `API Ninjas request failed (${response.status}). ${detail}`.trim() }),
    { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RECIPE_API_NINJAS_KEY") || Deno.env.get("API_NINJAS_KEY");
    if (!apiKey) throw new Error("API Ninjas is not configured yet. Set RECIPE_API_NINJAS_KEY in Supabase Edge Function Secrets.");

    const body = await request.json().catch(() => ({}));
    const search = buildQuery(body || {});
    if (!search) {
      return new Response(
        JSON.stringify({ error: "Add a search term or an ingredient so we can find a recipe.", recipes: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(API_NINJAS_URL);
    url.searchParams.set("query", search);

    const response = await fetch(url, {
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) return apiError(response);

    const raw = await response.json().catch(() => null);
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.recipes) ? raw.recipes : [];
    const recipes = list.map(normaliseRecipe).filter(Boolean).slice(0, 12);

    return new Response(JSON.stringify({ recipes, query: search, source: "api-ninjas" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("recipe-search failed", error);
    return new Response(
      JSON.stringify({ error: error.message || "Recipe lookup failed.", recipes: [] }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
