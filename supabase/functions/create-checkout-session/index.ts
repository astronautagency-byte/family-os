/* ── create-checkout-session ──────────────────────────────────────────────
 * Called from the Landing pricing card and (optionally) the post-signup
 * handoff. Creates or reuses a Stripe Customer for the household, opens a
 * Stripe Checkout Session in subscription mode with a 30-day trial, and
 * returns the redirect URL. Credit Card is the explicit payment method;
 * Stripe surfaces Apple Pay and Google Pay automatically when the user's
 * browser/wallet supports them — no extra code.
 *
 * Auth: requires an authenticated Supabase user (JWT in Authorization
 * header). Reads the household account_id from profiles and reuses an
 * existing stripe_customer_id if one is already on the subscription row.
 *
 * Body:
 *   {
 *     billing: "monthly" | "yearly",      // default "monthly"
 *     memberCount: number,                // base 2, max 20, default 2
 *     addons: ("smart_bundle"|"fam_ai")[],// default ["fam_ai"]
 *     returnPath?: string                 // e.g. "/billing/success"
 *   }
 *
 * Env: STRIPE_SECRET_KEY, STRIPE_PRICE_CORE_MONTHLY, STRIPE_PRICE_CORE_YEARLY,
 *      STRIPE_PRICE_BUNDLE_MONTHLY, STRIPE_PRICE_FAMAI_MONTHLY, FRONTEND_URL
 * -------------------------------------------------------------------------- */
import Stripe from "npm:stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

const PLAN_PRICES: Record<string, { env: string; label: string }> = {
  core_monthly: { env: "STRIPE_PRICE_CORE_MONTHLY", label: "Core (Monthly)" },
  core_yearly: { env: "STRIPE_PRICE_CORE_YEARLY", label: "Core (Yearly)" },
  bundle_monthly: { env: "STRIPE_PRICE_BUNDLE_MONTHLY", label: "Smart Family Bundle" },
  famai_monthly: { env: "STRIPE_PRICE_FAMAI_MONTHLY", label: "Fam AI" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return respond({ error: "Stripe is not configured on the server." }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return respond({ error: "Invalid JSON body." }, 400); }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return respond({ error: "Sign-in required to start a trial." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return respond({ error: "Server is misconfigured." }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return respond({ error: "Sign-in expired — please sign in again." }, 401);
  const user = userData.user;

  const profileRes = await admin
    .from("profiles")
    .select("account_id, full_name")
    .eq("user_id", user.id)
    .single();
  if (profileRes.error || !profileRes.data?.account_id) {
    return respond({ error: "Profile not found for this account." }, 400);
  }
  const accountId = profileRes.data.account_id as string;
  const accountEmail = user.email || "";
  const fullName = (profileRes.data.full_name as string) || "";

  // ── Parse + validate inputs ──
  const billing = body.billing === "yearly" ? "yearly" : "monthly";
  const memberCount = Math.max(2, Math.min(20, Number(body.memberCount) || 2));
  const addons = Array.isArray(body.addons)
    ? (body.addons as unknown[]).filter((a): a is string => a === "smart_bundle" || a === "fam_ai")
    : ["fam_ai"];
  const requestedReturn = typeof body.returnPath === "string" ? body.returnPath : "";

  // ── Build line items from configured price IDs ──
  const coreKey = billing === "yearly" ? "core_yearly" : "core_monthly";
  const corePrice = PLAN_PRICES[coreKey];
  const corePriceId = Deno.env.get(corePrice.env);
  if (!corePriceId) {
    return respond({ error: `Stripe price for ${coreKey} not configured (${corePrice.env}).` }, 500);
  }
  const lineItems: Array<{ price: string; quantity: number }> = [{ price: corePriceId, quantity: 1 }];
  if (addons.includes("smart_bundle")) {
    const id = Deno.env.get(PLAN_PRICES.bundle_monthly.env);
    if (!id) return respond({ error: `${PLAN_PRICES.bundle_monthly.env} not set.` }, 500);
    lineItems.push({ price: id, quantity: 1 });
  }
  if (addons.includes("fam_ai")) {
    const id = Deno.env.get(PLAN_PRICES.famai_monthly.env);
    if (!id) return respond({ error: `${PLAN_PRICES.famai_monthly.env} not set.` }, 500);
    lineItems.push({ price: id, quantity: 1 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

  // ── Reuse existing Stripe customer or create a new one ──
  const subRes = await admin
    .from("account_subscriptions")
    .select("stripe_customer_id")
    .eq("account_id", accountId)
    .maybeSingle();

  let customerId = (subRes.data?.stripe_customer_id as string | undefined) || null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: accountEmail,
      name: fullName || undefined,
      metadata: { famoso_account_id: accountId, famoso_user_id: user.id },
    });
    customerId = customer.id;
  }

  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://home.fam-os.app";
  const returnUrl = frontendUrl + (requestedReturn || "/today?trial_started=1");
  const successUrl = returnUrl.includes("?")
    ? `${returnUrl}&session_id={CHECKOUT_SESSION_ID}`
    : `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`;

  // Suppress per-extra-member checkout complexity — handled post-trial via
  // billing portal. Trial starts at the base plan price; the user can add
  // members or change billing later from Settings → Manage billing.
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    customer_update: { address: "auto", name: "auto" },
    line_items: lineItems,
    payment_method_types: ["card"], // CC; Apple/Google Pay auto-shown when wallet is present
    payment_method_collection: "always",
    subscription_data: {
      trial_period_days: 30,
      metadata: {
        famoso_account_id: accountId,
        addons: addons.join(","),
        member_count: String(memberCount),
        billing,
      },
    },
    metadata: {
      famoso_account_id: accountId,
      addons: addons.join(","),
      member_count: String(memberCount),
      billing,
    },
    allow_promotion_codes: true,
    success_url: successUrl,
    cancel_url: `${frontendUrl}/pricing?canceled=1`,
  });

  return respond({ url: session.url, sessionId: session.id });
});
