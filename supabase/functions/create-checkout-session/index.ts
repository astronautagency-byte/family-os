/* Stripe subscription checkout for FamOS Plus and Pro. */
import Stripe from "npm:stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkoutOffer } from "../_shared/checkoutPolicy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const PRICE_ENV: Record<string, { monthly: string; yearly: string }> = {
  plus: { monthly: "STRIPE_PRICE_PLUS_MONTHLY", yearly: "STRIPE_PRICE_PLUS_YEARLY" },
  pro: { monthly: "STRIPE_PRICE_PRO_MONTHLY", yearly: "STRIPE_PRICE_PRO_YEARLY" },
};

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Could not start secure checkout.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return respond({ error: "Stripe is not configured on the server." }, 500);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return respond({ error: "Sign-in required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return respond({ error: "Server is misconfigured." }, 500);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return respond({ error: "Sign-in expired. Please sign in again." }, 401);

    const { data: membership, error: membershipError } = await admin
      .from("household_members")
      .select("household_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (membershipError || !membership?.household_id) return respond({ error: "Household not found." }, 404);

    const { data: household } = await admin
      .from("households")
      .select("id, name, created_by")
      .eq("id", membership.household_id)
      .single();
    if (household?.created_by !== user.id && membership.role !== 'owner') return respond({error:'Only the household owner can start or change billing.'},403);

    const input = await req.json().catch(() => ({}));
    const { onboarding, feature, billing, trial } = checkoutOffer(input);
    const priceEnv = PRICE_ENV[feature][billing];
    const priceId = Deno.env.get(priceEnv);
    if (!priceId) return respond({ error: `Stripe price is not configured (${priceEnv}).` }, 500);
    const frontend = Deno.env.get("FRONTEND_URL") || "https://home.fam-os.app";

    const { data: current, error: subscriptionError } = await admin
      .from("account_subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status, provider")
      .eq("household_id", membership.household_id)
      .maybeSingle();
    if (subscriptionError) throw new Error("Could not verify existing billing. Please try again.");
    if (current && current.provider !== "stripe" && ["active", "trial", "trialing", "past_due"].includes(current.status)) {
      return respond({error:"This household already has access through another billing provider or promotion. Contact support before changing billing."},409);
    }
    if (current?.stripe_subscription_id && ["active", "trial", "trialing", "past_due"].includes(current.status)) {
      // Already subscribed — redirect to the billing portal so the user can upgrade from there
      if (current.stripe_customer_id) {
        const stripePortal = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
        const portalSession = await stripePortal.billingPortal.sessions.create({
          customer: current.stripe_customer_id,
          return_url: `${frontend}/settings`,
        });
        return respond({ url: portalSession.url, message: "Redirecting to billing portal to manage your subscription." });
      }
      return respond({ error: "This household already has a Stripe subscription. Use Manage billing to change it." }, 409);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    if (onboarding) {
      const price = await stripe.prices.retrieve(priceId);
      if (!price.active || price.currency !== "cad" || price.unit_amount !== (billing === "yearly" ? 19900 : 1999) || price.recurring?.interval !== (billing === "yearly" ? "year" : "month") || price.recurring?.interval_count !== 1) {
        return respond({error:"The Pro checkout price does not match the advertised offer. Please contact support."}, 503);
      }
    }
    let customerId = current?.stripe_customer_id || null;
    if(onboarding && customerId){
      const history=await stripe.subscriptions.list({customer:customerId,status:'all',limit:1});
      if(history.data.length) return respond({error:'This household has already had a subscription. Use Settings → Manage billing to choose a paid plan.'},409);
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: household?.name || "FamOS household",
        metadata: { famos_household_id: membership.household_id, famos_user_id: user.id },
      }, {idempotencyKey:`famos-customer-${membership.household_id}`});
      customerId = customer.id;
      const {error: saveError} = await admin.from("account_subscriptions").upsert({
        household_id: membership.household_id,
        provider: "stripe",
        plan_key: "core",
        status: "incomplete",
        amount_cents: 0,
        currency: "CAD",
        billing_interval: billing === "yearly" ? "year" : "month",
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "household_id" });
      if (saveError) throw new Error("Could not save billing setup. Please try again.");
    }

    // Stable across requests and edge instances; never use a time bucket, which
    // would allow duplicates at its boundary. An expired attempt supplies the
    // next generation, so users can still retry after Checkout's expiry.
    let checkoutIdempotencyKey: string | undefined;
    if (onboarding) {
      const sessions = await stripe.checkout.sessions.list({customer:customerId, limit:100});
      const reusable = sessions.data.find(session => session.status === "open" && session.metadata?.famos_offer === "pro-card-trial-7" && session.metadata?.famos_billing === billing);
      if (reusable?.url) return respond({url:reusable.url, sessionId:reusable.id});
      if (sessions.data.some(session => session.status === "open" && session.metadata?.famos_offer === "pro-card-trial-7")) {
        return respond({error:"A Pro trial checkout is already open with another billing interval. Finish or let that checkout expire before changing intervals."},409);
      }
      const previous = sessions.data.find(session => session.mode === "subscription");
      checkoutIdempotencyKey = `famos-pro-trial-v1-${customerId}-${previous?.id || "initial"}`;
      // Old immediate-charge sessions must not compete with the new trial offer.
      for (const old of sessions.data) if (old.mode === "subscription" && old.status === "open") await stripe.checkout.sessions.expire(old.id);
    }

    const successUrl = `${frontend}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontend}/settings?billing=cancelled`;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      customer_update: { address: "auto", name: "auto" },
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: ["card"],
      payment_method_collection: "always",
      subscription_data: {
        ...trial,
        metadata: {
          famos_household_id: membership.household_id,
          famos_user_id: user.id,
          famos_plan: feature,
          famos_billing: billing,
        },
      },
      metadata: {
        famos_offer: onboarding ? "pro-card-trial-7" : "paid",
        famos_household_id: membership.household_id,
        famos_user_id: user.id,
        famos_plan: feature,
        famos_billing: billing,
      },
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }, checkoutIdempotencyKey ? {idempotencyKey:checkoutIdempotencyKey} : undefined);
    return respond({ url: session.url, sessionId: session.id });
  } catch (error) {
    return respond({ error: errorMessage(error) }, 500);
  }
});
