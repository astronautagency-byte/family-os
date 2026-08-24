/* Stripe webhook: the only provider write path for FamOS subscriptions. */
import Stripe from "npm:stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const respond = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers });
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Unexpected Stripe webhook error.";
const iso = (seconds: number | null | undefined) => typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
const mapStatus = (status: string) => status === "trialing" ? "trial" : status === "active" ? "active" : status === "past_due" ? "past_due" : status === "canceled" ? "canceled" : status === "paused" ? "paused" : "incomplete";
const planFromPrice = (priceId: string) => {
  if (priceId && priceId === Deno.env.get("STRIPE_PRICE_PLUS_MONTHLY")) return "plus";
  if (priceId && priceId === Deno.env.get("STRIPE_PRICE_PLUS_YEARLY")) return "plus";
  if (priceId && priceId === Deno.env.get("STRIPE_PRICE_PRO_MONTHLY")) return "pro";
  if (priceId && priceId === Deno.env.get("STRIPE_PRICE_PRO_YEARLY")) return "pro";
  return "pro";
};

async function syncSubscription(admin: ReturnType<typeof createClient>, stripe: Stripe, sub: Stripe.Subscription) {
  const householdId = String(sub.metadata?.famos_household_id || "");
  if (!householdId) {
    console.warn(`[stripe-webhook] ignored ${sub.id}: missing famos_household_id metadata`);
    return;
  }
  const item = sub.items.data[0];
  const priceId = item?.price?.id || "";
  const plan = String(sub.metadata?.famos_plan || planFromPrice(priceId));
  const amount = Number(item?.price?.unit_amount || 0);
  const interval = item?.price?.recurring?.interval === "year" ? "year" : "month";
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  let brand = "";
  let last4 = "";
  const paymentMethod = (sub as unknown as { default_payment_method?: string | Stripe.PaymentMethod | null }).default_payment_method;
  try {
    const method = typeof paymentMethod === "string" ? await stripe.paymentMethods.retrieve(paymentMethod) : paymentMethod;
    brand = method?.card?.brand || "";
    last4 = method?.card?.last4 || "";
  } catch { /* A removed payment method should not block entitlement sync. */ }

  const { error } = await admin.rpc("upsert_from_stripe", {
    p_household_id: householdId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: sub.id,
    p_plan_key: plan,
    p_status: mapStatus(sub.status),
    p_amount_cents: amount,
    p_billing_interval: interval,
    p_trial_ends_at: iso(sub.trial_end),
    p_current_period_start: iso(sub.current_period_start),
    p_current_period_ends_at: iso(sub.current_period_end),
    p_cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    p_payment_method_brand: brand,
    p_payment_method_last4: last4,
    p_addons: [],
    p_member_count: 2,
    p_currency: String(sub.currency || "cad").toUpperCase(),
  });
  if (error) throw error;

  const eventType = sub.status === "canceled" ? "subscription_canceled" : sub.status === "past_due" ? "payment_failed" : sub.status === "active" ? "invoice_paid" : null;
  if (eventType) {
    await admin.rpc("admin_record_billing_event", {
      target_household: householdId,
      next_event_type: eventType,
      next_amount_cents: amount,
      next_currency: String(sub.currency || "cad").toUpperCase(),
      event_note: `Stripe ${plan} subscription ${sub.id} → ${mapStatus(sub.status)}`,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) return respond({ error: "Stripe webhook is not configured on the server." }, 500);
  const signature = req.headers.get("stripe-signature");
  if (!signature) return respond({ error: "Missing Stripe-Signature header." }, 400);

  const rawBody = await req.text();
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (error) {
    return respond({ error: `Signature verification failed: ${errorMessage(error)}` }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return respond({ error: "Server is misconfigured." }, 500);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (subscriptionId) await syncSubscription(admin, stripe, await stripe.subscriptions.retrieve(subscriptionId));
    } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      await syncSubscription(admin, stripe, event.data.object as Stripe.Subscription);
    } else if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      if (subscriptionId) await syncSubscription(admin, stripe, await stripe.subscriptions.retrieve(subscriptionId));
    }
    return respond({ received: true, processed: event.type });
  } catch (error) {
    console.error("[stripe-webhook] failed", errorMessage(error));
    return respond({ error: errorMessage(error) }, 500);
  }
});
