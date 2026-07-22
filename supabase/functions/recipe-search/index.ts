// Recipe search backed entirely by API Ninjas (`/v3/recipe` — current version
// as documented at https://api-ninjas.com/api/recipe). Strict sourcing: every
// recipe surfaced here comes from API Ninjas.
//
// Response shape per the docs (verified against https://api-ninjas.com/api/recipe,
// documented 2026): each recipe is an object with `title`, `ingredients` as
// `[{name, quantity, unit}]`, `servings` as a yield-description string
// ("6 servings"), `instructions` as a string array, plus optional `nutrition`.
// The free tier returns one recipe by default; `limit` and `offset` are
// premium-only. We do not fabricate fields the API doesn't return — `cuisine`
// and `total_time` were never part of API Ninjas and silently defaulting them
// hid the v1 → v3 break.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_NINJAS_URL = "https://api.api-ninjas.com/v3/recipe";
const API_NINJAS_SOURCE = "https://api-ninjas.com/api/recipe";
const DEFAULT_SERVINGS = 4;
const DEFAULT_RESULT_LIMIT = 3; // Free-tier default was 1; requesting 3 so the roulette picker has options to show.

const cleanText = (input = "", maxLength = 200) =>
  String(input || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

// API Ninjas returns `ingredients` as an array of `{name, quantity, unit}`
// objects (e.g. `{name: "Oil", quantity: 2, unit: "tablespoon"}`). Older cached
// payloads or scrape fallbacks may still be a single string — accept both.
const cleanIngredients = (raw) => {
  if (Array.isArray(raw)) {
    const items = raw
      .map((entry) => {
        if (entry == null) return null;
        if (typeof entry === "string") {
          const name = cleanText(entry, 80);
          return name ? { name, quantity: null, unit: "" } : null;
        }
        if (typeof entry === "object") {
          const name = cleanText(entry.name || entry.ingredient || "", 80);
          if (!name) return null;
          const quantityRaw = Number(entry.quantity);
          const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : null;
          const unit = cleanText(entry.unit || "", 16);
          return { name, quantity, unit };
        }
        return null;
      })
      .filter(Boolean);
    return items.slice(0, 20);
  }
  if (typeof raw === "string") {
    return String(raw)
      .replace(/\r/g, "")
      .split(/\n|·|•|;|\|(?<=\.)\s+/)
      .map((line) => line.trim().replace(/^[-*•\s]+/, ""))
      .filter((line) => line.length > 1)
      .slice(0, 20)
      .map((line) => ({ name: line, quantity: null, unit: "" }));
  }
  return [];
};

// API Ninjas returns `instructions` as a string array. Each element is one
// step. The legacy single-blob form (with "1. Step one\n2. Step two") is
// supported for cached payloads and unstitched upstream responses.
const cleanInstructions = (raw) => {
  if (Array.isArray(raw)) {
    return raw
      .map((step) => cleanText(step, 320))
      .filter((step) => step.length > 4)
      .slice(0, 12);
  }
  if (typeof raw === "string" && raw.trim()) {
    const text = raw.replace(/\r/g, "").trim();
    const byNewline = text
      .split(/\n+/)
      .map((line) =>
        line
          .trim()
          .replace(/^\d+[\.\)]\s*/, "")
          .replace(/^step\s*\d+\s*[:\-–]?\s*/i, "")
          .replace(/^[-*•]\s*/, ""),
      )
      .filter((line) => line.length > 4);
    if (byNewline.length > 1) return byNewline.slice(0, 12);
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
    const chunks = [];
    for (let i = 0; i < sentences.length && chunks.length < 12; i += 2) {
      const joined = sentences.slice(i, i + 2).join(" ").trim();
      if (joined && joined.length > 4) chunks.push(joined);
    }
    return chunks.length ? chunks : [cleanText(text, 320)];
  }
  return [];
};

// Servings is a yield description such as "6 servings" or "Makes about 4
// portions". Extract the first integer; fall back to a sane default only if
// the upstream returns nothing parseable.
const parseServings = (raw) => {
  const text = String(raw || "").trim();
  if (!text) return DEFAULT_SERVINGS;
  const match = text.match(/(\d+)/);
  if (!match) return DEFAULT_SERVINGS;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 50) return DEFAULT_SERVINGS;
  return n;
};

// API Ninjas does not return `total_time` or `readyInMinutes`. Walk the
// instruction list once and pick the first recognised duration phrase. If
// none is found, surface null and let the UI render "Plan the prep" rather
// than inventing a number.
const parseReadyInMinutes = (instructions) => {
  if (!Array.isArray(instructions)) return null;
  // Recognises: "30 min", "30 minutes", "1 hour", "1 hr", "1-2 hours",
  // "30-40 min" (averaged), "an hour" (60), "half an hour" (30).
  for (const step of instructions) {
    const text = String(step || "");
    const hourRange = text.match(/(\d+(?:\s*[\-–]\s*\d+)?)\s*(?:hours?|hrs?)\b/i);
    if (hourRange) {
      const parts = hourRange[1].split(/[\-–]/).map((p) => Number(p.trim()));
      const avg = parts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) / parts.length;
      if (Number.isFinite(avg) && avg > 0) return Math.max(1, Math.round(avg * 60));
    }
    const minRange = text.match(/(\d+(?:\s*[\-–]\s*\d+)?)\s*(?:min|minute)\b/i);
    if (minRange) {
      const parts = minRange[1].split(/[\-–]/).map((p) => Number(p.trim()));
      const avg = parts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) / parts.length;
      if (Number.isFinite(avg) && avg > 0) return Math.max(1, Math.round(avg));
    }
    if (/half an hour/i.test(text)) return 30;
  }
  return null;
};

const normaliseRecipe = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  const title = cleanText(payload.title, 120);
  if (!title) return null;
  const ingredients = cleanIngredients(payload.ingredients);
  const instructions = cleanInstructions(payload.instructions);
  return {
    title,
    ingredients,
    servings: parseServings(payload.servings),
    instructions,
    readyInMinutes: parseReadyInMinutes(instructions),
    source: "API Ninjas",
    sourceUrl: API_NINJAS_SOURCE,
  };
};

// API Ninjas accepts a free-text `query` parameter (name search) and an
// optional `ingredients` filter. Both can be used independently — the API
// requires at least a `title` OR `ingredients` parameter.
//
// - `query` → API Ninjas `title` param (recipe name search)
// - `ingredients` → API Ninjas `ingredients` param (ingredient-based search)
//
// Dietary restrictions, meal type, and cuisine are NOT sent to API Ninjas;
// they are applied client-side after results arrive.
const buildSearchParams = ({ query = "", ingredients = "" } = {}) => {
  const params = new URLSearchParams();
  const title = cleanText(query, 200);
  if (title) params.set("title", title);
  if (ingredients) params.set("ingredients", cleanText(ingredients, 180));
  params.set("limit", String(DEFAULT_RESULT_LIMIT));
  return params;
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
    const searchParams = buildSearchParams(body || {});
    if (!searchParams.get("title") && !searchParams.get("ingredients")) {
      return new Response(
        JSON.stringify({ error: "Add a recipe name or an ingredient so we can find a recipe.", recipes: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = `${API_NINJAS_URL}?${searchParams.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) return apiError(response);

    const raw = await response.json().catch(() => null);
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.recipes) ? raw.recipes : [];
    const recipes = list.map(normaliseRecipe).filter(Boolean);

    return new Response(JSON.stringify({ recipes, query: searchParams.get("title"), source: "api-ninjas" }), {
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
