import Stripe from "npm:stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!stripeKey || !supabaseUrl || !serviceKey || !token) return reply({ error: "Server is misconfigured." }, 500);
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) return reply({ error: "Sign-in required." }, 401);
    const { data: operator } = await admin.from("admin_users").select("email,is_active").eq("user_id", auth.user.id).maybeSingle();
    if (!operator?.is_active) return reply({ error: "Admin access required." }, 403);
    const { householdId, amountCents, note = "" } = await request.json().catch(() => ({}));
    const amount = Math.round(Number(amountCents));
    if (!householdId || !Number.isFinite(amount) || amount <= 0) return reply({ error: "A positive refund amount is required." }, 400);
    const { data: subscription } = await admin.from("account_subscriptions").select("stripe_customer_id,currency").eq("household_id", householdId).maybeSingle();
    if (!subscription?.stripe_customer_id) return reply({ error: "This family does not have a Stripe customer." }, 404);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const charges = await stripe.charges.list({ customer: subscription.stripe_customer_id, limit: 25 });
    const charge = charges.data.find((item) => item.paid && !item.refunded && Number(item.amount - item.amount_refunded) >= amount);
    if (!charge) return reply({ error: "No eligible Stripe payment can cover this refund." }, 409);
    const refund = await stripe.refunds.create({ charge: charge.id, amount, metadata: { famos_household_id: householdId, note: String(note || "") } });
    await admin.from("billing_events").insert({ household_id: householdId, event_type: "refund", amount_cents: amount, currency: subscription.currency || "CAD", provider: "stripe", external_event_id: `refund:${refund.id}`, metadata: { note, chargeId: charge.id } });
    await admin.from("admin_audit_log").insert({ admin_user_id: auth.user.id, admin_email: operator.email, action: "issue_stripe_refund", target_type: "household", target_id: householdId, details: { amountCents: amount, chargeId: charge.id, refundId: refund.id } });
    return reply({ refunded: true, refundId: refund.id });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Refund could not be completed." }, 500);
  }
});
