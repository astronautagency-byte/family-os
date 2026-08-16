import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chargebeeRequest, featureFromItemPrice } from "../_shared/chargebee.ts";
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const iso = (seconds?: number) => seconds ? new Date(seconds * 1000).toISOString() : null;
Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const expected = Deno.env.get("CHARGEBEE_WEBHOOK_AUTH") || "";
  if (!expected || req.headers.get("authorization") !== `Basic ${btoa(expected)}`) return reply({ error: "Unauthorized" }, 401);
  try {
    const incoming = await req.json();
    const eventId = incoming?.event?.id;
    if (!eventId) return reply({ error: "Missing event id" }, 400);
    // Retrieve the canonical event from Chargebee; do not trust webhook JSON alone.
    const verified = await chargebeeRequest(`/events/${encodeURIComponent(eventId)}`, undefined, "GET");
    const event = verified?.event;
    const sub = event?.content?.subscription;
    if (!sub) return reply({ received: true, ignored: event?.event_type });
    const customerId = String(sub.customer_id || "");
    const features = (sub.subscription_items || []).map((item: { item_price_id?: string }) => featureFromItemPrice(String(item.item_price_id || ""))).filter(Boolean);
    const active = ["active", "in_trial", "non_renewing"].includes(sub.status);
    const status = active ? (sub.status === "in_trial" ? "trial" : "active") : sub.status === "cancelled" ? "canceled" : "past_due";
    const amount = (sub.subscription_items || []).reduce((sum: number, item: { amount?: number }) => sum + Number(item.amount || 0), 0);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.rpc("upsert_from_chargebee", {
      target_household: customerId, customer_id: customerId, subscription_id: sub.id,
      next_status: status, item_features: features, next_amount_cents: amount,
      next_currency: sub.currency_code || "CAD", period_start: iso(sub.current_term_start), period_end: iso(sub.current_term_end),
    });
    return reply({ received: true, processed: event.event_type });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : "Webhook failed." }, 500); }
});
