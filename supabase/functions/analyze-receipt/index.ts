import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeCategory(category = "") {
  const allowed = ["Groceries", "Dining", "Transport", "Home", "Kids", "Health", "Entertainment", "Other"];
  const match = allowed.find((item) => item.toLowerCase() === String(category).toLowerCase());
  return match || "Other";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Sign in to analyze receipts.");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Your session has expired.");

    const { image, fileName = "" } = await request.json();
    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) throw new Error("Upload a receipt image first.");

    const xaiKey = Deno.env.get("XAI_API_KEY");
    if (!xaiKey) throw new Error("Receipt analysis is not configured yet.");

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${xaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("XAI_VISION_MODEL") || Deno.env.get("XAI_MODEL") || "grok-4.5",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You extract receipt data for a family finance app. Return only valid JSON with merchant, total, date, category, confidence, and notes. Category must be one of: Groceries, Dining, Transport, Home, Kids, Health, Entertainment, Other. Use CAD if currency is unclear.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Analyze this receipt image. Filename: ${fileName}. Return {"merchant":"...","total":"0.00","date":"YYYY-MM-DD","category":"Groceries","confidence":0.0,"notes":"short reason"}. Prefer the final amount paid or grand total.` },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Receipt analysis failed (${response.status}): ${details.slice(0, 240)}`);
    }
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const result = {
      merchant: String(parsed.merchant || "").slice(0, 120),
      total: String(parsed.total || parsed.amount || "").replace(/[^0-9.]/g, ""),
      date: parsed.date || new Date().toISOString().slice(0, 10),
      category: normalizeCategory(parsed.category),
      confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0.75,
      notes: String(parsed.notes || "Extracted from receipt image.").slice(0, 220),
    };
    return new Response(JSON.stringify(result), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
