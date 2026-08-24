/* Stripe subscription checkout for FamOS Plus and Pro. */
import Stripe from "npm:stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    if (household?.created_by !== user.id && membership.role !== "owner") {
      return respond({ error: "Only the household owner can change billing." }, 403);
    }

    const input = await req.json().catch(() => ({}));
    const feature = input.feature === "plus" ? "plus" : input.feature === "pro" ? "pro" : "pro";
    const billing = input.billing === "yearly" || input.billing === "annual" ? "yearly" : "monthly";
    const priceEnv = PRICE_ENV[feature][billing];
    const priceId = Deno.env.get(priceEnv);
    if (!priceId) return respond({ error: `Stripe price is not configured (${priceEnv}).` }, 500);

    const { data: current } = await admin
      .from("account_subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("household_id", membership.household_id)
      .maybeSingle();
    if (current?.stripe_subscription_id && ["active", "trial", "trialing", "past_due"].includes(current.status)) {
      return respond({ error: "This household already has a Stripe subscription. Use Manage billing to change it." }, 409);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    let customerId = current?.stripe_customer_id || null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: household?.name || "FamOS household",
        metadata: { famos_household_id: membership.household_id, famos_user_id: user.id },
      });
      customerId = customer.id;
      await admin.from("account_subscriptions").upsert({
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
    }

    const frontend = Deno.env.get("FRONTEND_URL") || "https://home.fam-os.app";
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
        // Every new paid signup receives the advertised card-backed trial.
        trial_period_days: 30,
        metadata: {
          famos_household_id: membership.household_id,
          famos_user_id: user.id,
          famos_plan: feature,
          famos_billing: billing,
        },
      },
      metadata: {
        famos_household_id: membership.household_id,
        famos_user_id: user.id,
        famos_plan: feature,
        famos_billing: billing,
      },
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    return respond({ url: session.url, sessionId: session.id });
  } catch (error) {
    return respond({ error: errorMessage(error) }, 500);
  }
});
