import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chargebeeRequest } from "../_shared/chargebee.ts";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) return reply({ error: "Sign-in required." }, 401);
    const { data: membership } = await admin.from("household_members").select("household_id, role").eq("user_id", auth.user.id).limit(1).single();
    const { data: household } = await admin.from("households").select("created_by, name").eq("id", membership?.household_id).single();
    if (household?.created_by !== auth.user.id && membership?.role !== "owner") return reply({ error: "Only the household owner can manage billing." }, 403);
    const { data: sub } = await admin.from("account_subscriptions").select("household_id, chargebee_customer_id").eq("household_id", membership.household_id).maybeSingle();
    let customerId = sub?.chargebee_customer_id || membership.household_id;
    if (!sub?.chargebee_customer_id) {
      const customerForm = new URLSearchParams({ id: customerId, email: auth.user.email || "", first_name: household?.name || "FamOS household" });
      try { await chargebeeRequest("/customers", customerForm); }
      catch (error) { if (!/already exists|duplicate/i.test(error instanceof Error ? error.message : "")) throw error; }
      const billingRecord = { chargebee_customer_id: customerId, updated_at: new Date().toISOString() };
      const { error: saveError } = sub?.household_id
        ? await admin.from("account_subscriptions").update(billingRecord).eq("household_id", membership.household_id)
        : await admin.from("account_subscriptions").insert({ household_id: membership.household_id, provider: "chargebee", plan_key: "free", status: "paused", amount_cents: 0, currency: "CAD", billing_interval: "month", ...billingRecord });
      if (saveError) throw new Error("Billing profile could not be linked. Please try again.");
    }
    const form = new URLSearchParams({ "customer[id]": customerId, redirect_url: `${Deno.env.get("FRONTEND_URL") || "https://home.fam-os.app"}/#settings` });
    const result = await chargebeeRequest("/portal_sessions", form);
    return reply({ url: result?.portal_session?.access_url });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : "Could not open billing." }, 500); }
});
