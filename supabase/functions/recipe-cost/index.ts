// Spoonacular recipe cost estimation.
// Returns price breakdown per recipe: total cost, cost per serving,
// and individual ingredient costs.
// Docs: https://spoonacular.com/food-api/docs#Get-Recipe-Price-Breakdown-by-ID

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

    const { recipeId } = await request.json().catch(() => ({}));
    if (!recipeId) return json({ error: "recipeId is required." }, 400);

    const response = await fetch(`${SPOONACULAR_BASE}/recipes/${encodeURIComponent(recipeId)}/priceBreakdownWidget.json`, {
      method: "GET",
      headers: { "x-api-key": apiKey, Accept: "application/json" },
    });

    if (!response.ok) {
      if (response.status === 402 || response.status === 429) return json({ error: "Spoonacular quota reached." }, 429);
      return json({ error: `Spoonacular request failed (${response.status}).` }, 502);
    }

    const raw = await response.json().catch(() => null);
    if (!raw) return json({ error: "Could not parse cost data." }, 502);

    const ingredients = (Array.isArray(raw.ingredients) ? raw.ingredients : []).map((item) => ({
      name: cleanText(item.name, 100),
      amount: Number(item.amount) || 0,
      unit: cleanText(item.unit, 20),
      cost: Number(item.cost) || 0,
      costPerServing: Number(item.costPerServing) || 0,
    }));

    return json({
      totalCost: Number(raw.totalCost) || 0,
      totalCostPerServing: Number(raw.totalCostPerServing) || 0,
      currency: "USD",
      ingredients,
      usage,
    });
  } catch (error) {
    console.error("recipe-cost failed", error);
    return json({ error: error?.message || "Cost lookup failed." }, 400);
  }
});
