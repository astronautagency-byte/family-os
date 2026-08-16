// Spoonacular packaged-food lookup. The provider key remains server-side.
// Docs: https://spoonacular.com/food-api/docs#Search-Grocery-Products-by-UPC

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const clean = (value = "", length = 300) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, length);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("SPOONACULAR_API_KEY");
    if (!apiKey) return json({ error: "Spoonacular is not configured." }, 400);
    const body = await request.json().catch(() => ({}));
    const upc = clean(body?.upc, 18).replace(/\D/g, "");
    if (!upc) return json({ error: "Provide a UPC or EAN barcode." }, 400);
    const response = await fetch(`https://api.spoonacular.com/food/products/upc/${encodeURIComponent(upc)}`, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
    });
    if (response.status === 404) return json({ product: null, source: "spoonacular" });
    if (response.status === 402 || response.status === 429) return json({ error: "Spoonacular quota reached." }, 429);
    if (!response.ok) return json({ error: `Product lookup failed (${response.status}).` }, 502);
    const raw = await response.json().catch(() => null);
    if (!raw?.id && !raw?.title) return json({ product: null, source: "spoonacular" });
    return json({
      source: "spoonacular",
      product: {
        id: raw.id ? String(raw.id) : upc,
        upc,
        name: clean(raw.title || raw.name, 140),
        brand: clean(raw.brand || raw.manufacturer, 100),
        imageUrl: clean(raw.images?.[0] || raw.image, 500),
        aisle: clean(raw.aisle, 100),
        servingSize: clean(raw.serving_size || raw.servingSize, 60),
        nutrition: raw.nutrition && typeof raw.nutrition === "object" ? raw.nutrition : null,
      },
    });
  } catch (error) {
    console.error("food-product-lookup failed", error);
    return json({ error: "Product lookup is temporarily unavailable." }, 502);
  }
});
