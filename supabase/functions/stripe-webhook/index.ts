/* ── stripe-webhook ────────────────────────────────────────────────────────
 * Receives events from Stripe and mirrors the household's subscription
 * state into account_subscriptions via the upsert_from_stripe RPC.
 *
 * Handles:
 *   - checkout.session.completed      → upserts subscription row
 *   - customer.subscription.created  → upserts
 *   - customer.subscription.updated  → upserts
 *   - customer.subscription.deleted  → upserts (status=canceled) +
 *                                       records subscription_canceled via
 *                                       admin_record_billing_event
 *   - invoice.payment_succeeded      → upserts (status flipped to 'active'
 *                                       after trial) + records invoice_paid
 *   - invoice.payment_failed         → upserts (status=past_due) +
 *                                       records payment_failed
 *
 * Auth: verified via Stripe-Signature header using STRIPE_WEBHOOK_SECRET.
 * Public endpoint — Supabase auth NOT required.
 *
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL,
 *      SUPABASE_SERVICE_ROLE_KEY
 * -------------------------------------------------------------------------- */
import Stripe from "npm:stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const errorMessage = (err: unknown): string => {
  if (err && typeof err === "object") {
    const anyErr = err as { raw?: { message?: string }; message?: string };
    if (typeof anyErr.raw?.message === "string") return anyErr.raw.message;
    if (typeof anyErr.message === "string") return anyErr.message;
  }
  return typeof err === "string" ? err : "Unexpected error.";
};

const mapStripeStatus = (s: string): string => {
  if (s === "trialing") return "trial";
  if (s === "active") return "active";
  if (s === "past_due") return "past_due";
  if (s === "canceled") return "canceled";
  if (s === "unpaid" || s === "incomplete" || s === "incomplete_expired") return "incomplete";
  if (s === "paused") return "paused";
  return "incomplete";
};

const ISO_FROM_UNIX = (seconds: number | null | undefined): string | null => {
  if (!seconds || typeof seconds !== "number") return null;
  return new Date(seconds * 1000).toISOString();
};

const handleSubscription = async (
  admin: ReturnType<typeof createClient>,
  stripe: Stripe,
  sub: Stripe.Subscription,
) => {
  const accountId = (sub.metadata?.famoso_account_id as string | undefined) || null;
  if (!accountId) {
    console.warn("[stripe-webhook] subscription missing famoso_account_id metadata", sub.id);
    return;
  }

  const status = mapStripeStatus(sub.status);
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id;
  const amountCents = Number(item?.price?.unit_amount || 0);
  const interval = (item?.price?.recurring?.interval as string) || "month";

  // Stripe exposes the default payment method via the customer when expanded;
  // we fetch the customer separately to keep the subscription object light.
  const pmId = (sub as unknown as { default_payment_method?: string | Stripe.PaymentMethod | null })
    .default_payment_method;
  let brand = "";
  let last4 = "";
  try {
    const pm = typeof pmId === "string"
      ? await stripe.paymentMethods.retrieve(pmId)
      : (pmId as Stripe.PaymentMethod | null);
    if (pm?.card) {
      brand = String(pm.card.brand || "");
      last4 = String(pm.card.last4 || "");
    }
  } catch (_err) {
    // PM might be unattached or already removed — not fatal.
  }

  const addonsCsv = String(sub.metadata?.addons || "");
  const addons = addonsCsv.split(",").map((s) => s.trim()).filter(Boolean);
  const memberCount = Number(sub.metadata?.member_count || 2);

  await admin.rpc("upsert_from_stripe", {
    p_account_id: accountId,
    p_stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    p_stripe_subscription_id: sub.id,
    p_status: status,
    p_amount_cents: amountCents,
    p_billing_interval: interval,
    p_trial_ends_at: ISO_FROM_UNIX(sub.trial_end),
    p_current_period_start: ISO_FROM_UNIX(sub.current_period_start),
    p_current_period_ends_at: ISO_FROM_UNIX(sub.current_period_end),
    p_cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    p_payment_method_brand: brand,
    p_payment_method_last4: last4,
    p_addons: addons,
    p_member_count: memberCount,
    p_currency: sub.currency || "usd",
  });

  // Mirror to revenue tracking (admin-facing MRR/ARR charts use this).
  const eventType =
    status === "canceled" ? "subscription_canceled" :
    status === "past_due" ? "payment_failed" :
    status === "active" ? "invoice_paid" :
    null;
  if (eventType) {
    await admin.rpc("admin_record_billing_event", {
      target_household: accountId,
      next_event_type: eventType,
      next_amount_cents: amountCents,
      next_currency: sub.currency || "usd",
      event_note: `Stripe subscription ${sub.id} → ${status}`,
    }).catch((err) => console.warn("[stripe-webhook] admin_record_billing_event:", errorMessage(err)));
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    return respond({ error: "Webhook is not configured on the server." }, 500);
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return respond({ error: "Missing Stripe-Signature header." }, 400);

  const rawBody = await req.text();
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
  } catch (err) {
    return respond({ error: `Signature verification failed: ${errorMessage(err)}` }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return respond({ error: "Server is misconfigured." }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const subId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await handleSubscription(admin, stripe, sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscription(admin, stripe, event.data.object);
        break;
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const inv = event.data.object;
        const subRef = inv.subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await handleSubscription(admin, stripe, sub);
        }
        break;
      }
      default:
        // Other events we don't act on (e.g. payment_intent.* standalone)
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler failed:", errorMessage(err));
    return respond({ error: errorMessage(err) }, 500);
  }

  return respond({ received: true, processed: event.type });
});
