/* ── billing-portal ────────────────────────────────────────────────────────
 * Self-service billing management for households. Returns a URL to Stripe's
 * Customer Portal, where the user can:
 *   - Update card / payment method
 *   - Cancel the subscription (at period end)
 *   - Reactivate if previously canceled
 *   - Switch between monthly and yearly billing
 *   - Download past invoices
 *
 * Auth: requires an authenticated Supabase user (JWT). Looks up the
 * household's stripe_customer_id from account_subscriptions and creates
 * a one-time portal session.
 *
 * Body: none required.
 *
 * Env: STRIPE_SECRET_KEY, FRONTEND_URL
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return respond({ error: "Stripe is not configured on the server." }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return respond({ error: "Sign-in required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return respond({ error: "Server is misconfigured." }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !userData?.user) return respond({ error: "Sign-in expired — please sign in again." }, 401);

  const { data: membership, error: membershipError } = await admin
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", userData.user.id)
    .limit(1)
    .single();
  if (membershipError || !membership?.household_id) {
    return respond({ error: "Household not found." }, 404);
  }
  // Allow any household member to access the billing portal
  // Stripe portal is scoped to the customer, so access is safe for all members.

  const subRes = await admin
    .from("account_subscriptions")
    .select("stripe_customer_id")
    .eq("household_id", membership.household_id)
    .maybeSingle();

  if (!subRes.data?.stripe_customer_id) {
    return respond({
      error: "No active subscription on file. Start a free trial from the pricing page first.",
    }, 400);
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://home.fam-os.app";

  const session = await stripe.billingPortal.sessions.create({
    customer: subRes.data.stripe_customer_id as string,
    return_url: `${frontendUrl}/settings`,
  });

  return respond({ url: session.url });
});
