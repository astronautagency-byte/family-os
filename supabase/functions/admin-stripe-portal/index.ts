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
    const { customerId } = await request.json().catch(() => ({}));
    if (!customerId) return reply({ error: "Stripe customer is required." }, 400);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const session = await stripe.billingPortal.sessions.create({
      customer: String(customerId),
      return_url: `${Deno.env.get("FRONTEND_URL") || "https://home.fam-os.app"}/admin`,
    });
    await admin.from("admin_audit_log").insert({ admin_user_id: auth.user.id, admin_email: operator.email, action: "open_stripe_customer_portal", target_type: "stripe_customer", target_id: String(customerId), details: {} });
    return reply({ url: session.url });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Billing portal could not be opened." }, 500);
  }
});
