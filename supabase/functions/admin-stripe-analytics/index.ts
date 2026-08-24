import Stripe from "npm:stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const iso = (seconds?: number | null) => seconds ? new Date(seconds * 1000).toISOString() : null;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return reply({ error: "Stripe is not configured on the server." }, 500);
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!token || !supabaseUrl || !serviceKey) return reply({ error: "Server is misconfigured." }, 500);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) return reply({ error: "Sign-in required." }, 401);
    const { data: operator } = await admin.from("admin_users").select("email,is_active").eq("user_id", auth.user.id).maybeSingle();
    if (!operator?.is_active) return reply({ error: "Admin access required." }, 403);

    const body = await request.json().catch(() => ({}));
    const days = Math.min(730, Math.max(7, Number(body?.days || 90)));
    const since = Math.floor((Date.now() - days * 86_400_000) / 1000);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const [subscriptions, invoices] = await Promise.all([
      stripe.subscriptions.list({ limit: 100, status: "all", expand: ["data.items.data.price"] }),
      stripe.invoices.list({ limit: 100, created: { gte: since } }),
    ]);

    const liveStatuses = new Set(["active", "trialing", "past_due"]);
    const monthlyValue = (subscription: Stripe.Subscription) => subscription.items.data.reduce((sum, item) => {
      const amount = Number(item.price.unit_amount || 0);
      const recurring = item.price.recurring;
      if (!recurring) return sum;
      if (recurring.interval === "year") return sum + amount / (Math.max(1, recurring.interval_count) * 12);
      if (recurring.interval === "week") return sum + amount * 52 / (Math.max(1, recurring.interval_count) * 12);
      if (recurring.interval === "day") return sum + amount * 365 / (Math.max(1, recurring.interval_count) * 12);
      return sum + amount / Math.max(1, recurring.interval_count);
    }, 0);
    const mrrCents = Math.round(subscriptions.data.filter((sub) => liveStatuses.has(sub.status)).reduce((sum, sub) => sum + monthlyValue(sub), 0));
    const paidInvoices = invoices.data.filter((invoice) => invoice.status === "paid");
    const failedInvoices = invoices.data.filter((invoice) => ["open", "uncollectible", "void"].includes(invoice.status || ""));
    const collectedCents = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid || 0), 0);
    const currency = subscriptions.data[0]?.currency?.toUpperCase() || invoices.data[0]?.currency?.toUpperCase() || "CAD";

    return reply({
      generatedAt: new Date().toISOString(),
      days,
      currency,
      metrics: {
        mrrCents,
        arrCents: mrrCents * 12,
        active: subscriptions.data.filter((sub) => sub.status === "active").length,
        trials: subscriptions.data.filter((sub) => sub.status === "trialing").length,
        nonRenewing: subscriptions.data.filter((sub) => sub.cancel_at_period_end).length,
        pastDue: subscriptions.data.filter((sub) => sub.status === "past_due").length,
        canceled: subscriptions.data.filter((sub) => sub.status === "canceled").length,
        collectedCents,
        refundedCents: 0,
        netCollectedCents: collectedCents,
        outstandingCents: invoices.data.reduce((sum, invoice) => sum + Number(invoice.amount_remaining || 0), 0),
        paidInvoices: paidInvoices.length,
        failedInvoices: failedInvoices.length,
      },
      subscriptions: subscriptions.data.map((sub) => ({
        id: sub.id,
        customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        status: sub.status === "trialing" ? "in_trial" : sub.status === "past_due" ? "past_due" : sub.status,
        currency: sub.currency?.toUpperCase() || currency,
        mrrCents: Math.round(monthlyValue(sub)),
        startedAt: iso(sub.start_date),
        trialEndsAt: iso(sub.trial_end),
        renewsAt: iso(sub.current_period_end),
        items: sub.items.data.map((item) => item.price.id),
      })),
      invoices: invoices.data.map((invoice) => ({
        id: invoice.id,
        customerId: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
        subscriptionId: typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id,
        status: invoice.status || "draft",
        currency: invoice.currency?.toUpperCase() || currency,
        totalCents: Number(invoice.total || 0),
        paidCents: Number(invoice.amount_paid || 0),
        dueCents: Number(invoice.amount_remaining || 0),
        date: iso(invoice.created),
        dueDate: iso(invoice.due_date),
      })),
      stripeUrl: "https://dashboard.stripe.com",
    });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Stripe reporting could not be loaded." }, 500);
  }
});
