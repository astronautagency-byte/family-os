import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const CATEGORY_RULES: [string, string[]][] = [
  ["Dairy & Eggs", ["milk", "egg", "yogurt", "cheese", "butter", "cream"]],
  ["Produce", ["apple", "banana", "broccoli", "lettuce", "spinach", "avocado", "tomato", "garlic", "onion", "potato", "carrot", "berry", "pepper", "orange", "lemon", "lime"]],
  ["Bakery", ["bread", "bagel", "bun", "tortilla", "pita"]],
  ["Meat & Seafood", ["chicken", "beef", "pork", "turkey", "salmon", "tuna", "shrimp", "fish", "steak"]],
  ["Pantry", ["rice", "pasta", "flour", "sugar", "oil", "vinegar", "oats", "beans", "cereal", "sauce"]],
  ["Snacks", ["chips", "crackers", "cookies", "granola", "popcorn"]],
  ["Beverages", ["juice", "coffee", "tea", "soda", "water"]],
  ["Frozen", ["frozen", "ice cream"]],
  ["Baby", ["diaper", "wipes", "formula"]],
  ["Pet Supplies", ["dog", "cat", "pet", "litter"]],
  ["Household", ["detergent", "soap", "cleaner", "paper towel", "toilet paper"]],
];

function inferCategory(name = "") {
  const n = name.toLowerCase();
  const match = CATEGORY_RULES.find(([, terms]) => terms.some((t) => n.includes(t)));
  return match?.[0] || "Other";
}

function parseGroceryLines(text: string) {
  return text
    .split(/[\n,]+/)
    .map((l) => l.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean)
    .map((line) => {
      let cleaned = line;
      let quantity = 1;
      const leading = cleaned.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
      if (leading) {
        quantity = Number(leading[1]) || 1;
        cleaned = leading[2].trim();
      }
      return { name: cleaned, category: inferCategory(cleaned), quantity };
    });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: userError } = await admin.auth.getUser(accessToken);
    if (userError || !user) return json({ error: "Invalid session" }, 401);

    const { data: membership } = await admin
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership?.household_id) return json({ error: "No household found" }, 400);

    const householdId = membership.household_id;
    const { items: groceryText } = await request.json();

    if (!groceryText?.trim()) return json({ error: "items is required" }, 400);

    const parsed = parseGroceryLines(groceryText);
    if (!parsed.length) return json({ error: "No items to import." }, 400);

    // Deduplicate against existing items
    const { data: existing } = await admin
      .from("grocery_items")
      .select("name")
      .eq("household_id", householdId);

    const existingNames = new Set(
      (existing || []).map((i) => i.name?.toLowerCase()).filter(Boolean)
    );

    const rows = parsed
      .filter((item) => !existingNames.has(item.name.toLowerCase()))
      .map((item) => ({
        household_id: householdId,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: "",
        added_by: user.id,
      }));

    if (!rows.length) return json({ imported: 0, message: "All items already exist." });

    const { error } = await admin.from("grocery_items").insert(rows);
    if (error) return json({ error: error.message }, 500);

    return json({
      imported: rows.length,
      duplicates_skipped: parsed.length - rows.length,
      message: `Added ${rows.length} items to your shopping list.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
