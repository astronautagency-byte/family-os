// Find similar recipes via Spoonacular.
// Docs: https://spoonacular.com/food-api/docs#Get-Similar-Recipes

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { consumeUsage, usageLimitResponse } from "../_shared/usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPOONACULAR_BASE = "https://api.spoonacular.com";
const cleanText = (input = "", maxLength = 200) => String(input || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const usage = await consumeUsage(request, "premium_api_operations");
    if (!usage.allowed) return usageLimitResponse(usage, corsHeaders);

    const apiKey = Deno.env.get("SPOONACULAR_API_KEY");
    if (!apiKey) return json({ error: "Spoonacular is not configured yet." }, 400);

    const { recipeId, number } = await request.json().catch(() => ({}));
    if (!recipeId) return json({ error: "recipeId is required." }, 400);

    const limit = Math.min(Math.max(Number(number) || 6, 1), 12);

    const response = await fetch(`${SPOONACULAR_BASE}/recipes/${encodeURIComponent(recipeId)}/similar?number=${limit}&apiKey=${apiKey}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      if (response.status === 402 || response.status === 429) return json({ error: "Spoonacular quota reached." }, 429);
      return json({ error: `Spoonacular request failed (${response.status}).` }, 502);
    }

    const raw = await response.json().catch(() => null);
    if (!raw || !Array.isArray(raw)) return json({ recipes: [] });

    const recipes = raw.map((item) => ({
      id: String(item.id || ""),
      title: cleanText(item.title, 140),
      image: cleanText(item.image, 500),
      servings: Number(item.servings) || 0,
      readyInMinutes: Number(item.readyInMinutes) || 0,
      sourceUrl: cleanText(item.sourceUrl, 500),
    }));

    return json({ recipes, usage });
  } catch (error) {
    console.error("recipe-similar failed", error);
    return json({ error: error?.message || "Similar recipes lookup failed." }, 400);
  }
});
