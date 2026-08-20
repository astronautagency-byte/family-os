import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chargebeeRequest, featureItemPrice, FEATURE_ENV } from "../_shared/chargebee.ts";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) return reply({ error: "Sign-in required." }, 401);
    const { data: membership } = await admin.from("household_members").select("household_id, role").eq("user_id", auth.user.id).limit(1).single();
    if (!membership?.household_id) return reply({ error: "Household not found." }, 404);
    const { data: household } = await admin.from("households").select("created_by, name").eq("id", membership.household_id).single();
    if (household?.created_by !== auth.user.id && membership.role !== "owner") return reply({ error: "Only the household owner can change billing." }, 403);

    const input = await req.json().catch(() => ({}));
    const requested = Array.isArray(input.features) ? input.features : [input.feature];
    const features = [...new Set(requested.map(String))].filter((feature) => Object.hasOwn(FEATURE_ENV, feature));
    if (!features.length) return reply({ error: "Choose a plan to upgrade to." }, 400);

    const planFeature = features[0];
    const frontend = Deno.env.get("FRONTEND_URL") || "https://home.fam-os.app";
    const { data: current } = await admin.from("account_subscriptions").select("chargebee_subscription_id").eq("household_id", membership.household_id).maybeSingle();
    const form = new URLSearchParams();
    form.set("layout", "full_page");
    form.set("redirect_url", `${frontend}/#settings?billing=success`);
    form.set("cancel_url", `${frontend}/#settings?billing=cancelled`);

    if (current?.chargebee_subscription_id) {
      form.set("subscription[id]", current.chargebee_subscription_id);
      form.set("subscription_items[item_price_id][0]", featureItemPrice(planFeature));
      form.set("subscription_items[quantity][0]", "1");
      form.set("replace_items_list", "true");
      const result = await chargebeeRequest("/hosted_pages/checkout_existing_for_items", form);
      return reply({ url: result?.hosted_page?.url });
    }

    form.set("subscription_items[item_price_id][0]", featureItemPrice(planFeature));
    form.set("subscription_items[quantity][0]", "1");
    form.set("customer[id]", membership.household_id);
    form.set("customer[email]", auth.user.email || "");
    form.set("customer[first_name]", household?.name || "FamOS household");
    form.set("subscription[cf_famos_household_id]", membership.household_id);
    const result = await chargebeeRequest("/hosted_pages/checkout_new_for_items", form);
    return reply({ url: result?.hosted_page?.url });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Could not start checkout." }, 500);
  }
});
