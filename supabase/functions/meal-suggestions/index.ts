import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { ingredients, mealType = "dinner" } = await request.json();
    if (!ingredients?.trim()) throw new Error("Add some ingredients first.");
    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) throw new Error("GROQ_API_KEY is not configured in Supabase Edge Function Secrets.");
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are a practical family meal planner. Always return valid JSON." },
          { role: "user", content: `Return {"meals":[{"title":"...","notes":"..."}]}. Suggest exactly 5 practical ${mealType} meals. Every suggestion must visibly and meaningfully use these ingredients: ${ingredients}. Mention the used ingredient in each title or note. Do not suggest dishes inappropriate for ${mealType}. Notes must be one short sentence naming preparation, additions, or substitutions.` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Groq request failed (${response.status}): ${details.slice(0, 300)}`);
    }
    const result = await response.json();
    const parsed = JSON.parse(result.choices?.[0]?.message?.content || "{}");
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
