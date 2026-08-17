import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chargebeeConfig, chargebeeRequest } from "../_shared/chargebee.ts";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const iso = (seconds?: number) => seconds ? new Date(seconds * 1000).toISOString() : null;

const listAll = async (path: string, limit = 300) => {
  const rows: any[] = [];
  let offset = "";
  while (rows.length < limit) {
    const join = path.includes("?") ? "&" : "?";
    const page = await chargebeeRequest(`${path}${join}limit=100${offset ? `&offset=${encodeURIComponent(offset)}` : ""}`, undefined, "GET");
    rows.push(...(page?.list || []));
    offset = page?.next_offset || "";
    if (!offset) break;
  }
  return rows.slice(0, limit);
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) return reply({ error: "Sign-in required." }, 401);
    const { data: operator } = await admin.from("admin_users").select("email,is_active").eq("user_id", auth.user.id).maybeSingle();
    if (!operator?.is_active) return reply({ error: "Admin access required." }, 403);

    const body = await request.json().catch(() => ({}));
    const days = Math.min(730, Math.max(7, Number(body?.days || 90)));
    const since = Math.floor((Date.now() - days * 86_400_000) / 1000);
    const [subscriptionRows, invoiceRows, transactionRows] = await Promise.all([
      listAll("/subscriptions?sort_by%5Bdesc%5D=created_at"),
      listAll(`/invoices?sort_by%5Bdesc%5D=date&date%5Bafter%5D=${since}`),
      listAll(`/transactions?sort_by%5Bdesc%5D=date&date%5Bafter%5D=${since}`),
    ]);
    const subscriptions = subscriptionRows.map((row) => row.subscription).filter(Boolean);
    const invoices = invoiceRows.map((row) => row.invoice).filter(Boolean);
    const transactions = transactionRows.map((row) => row.transaction).filter(Boolean);
    const liveStatuses = new Set(["active", "in_trial", "non_renewing"]);
    const recurringMonthly = (sub: any) => (sub.subscription_items || []).reduce((sum: number, item: any) => {
      const amount = Number(item.amount || 0);
      const unit = String(item.billing_period_unit || sub.billing_period_unit || "month");
      const period = Math.max(1, Number(item.billing_period || sub.billing_period || 1));
      if (unit === "year") return sum + amount / (period * 12);
      if (unit === "week") return sum + amount * 52 / (period * 12);
      if (unit === "day") return sum + amount * 365 / (period * 12);
      return sum + amount / period;
    }, 0);
    const mrrCents = Math.round(subscriptions.filter((sub) => liveStatuses.has(sub.status)).reduce((sum, sub) => sum + recurringMonthly(sub), 0));
    const payments = transactions.filter((item) => item.status === "success" && item.type === "payment");
    const refunds = transactions.filter((item) => item.status === "success" && item.type === "refund");
    const collectedCents = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const refundedCents = refunds.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const currency = subscriptions.find((sub) => sub.currency_code)?.currency_code || invoices.find((item) => item.currency_code)?.currency_code || "CAD";
    const { baseUrl } = chargebeeConfig();
    const siteUrl = baseUrl.replace(/\/api\/v2$/, "");

    return reply({
      generatedAt: new Date().toISOString(), days, currency,
      metrics: {
        mrrCents, arrCents: mrrCents * 12,
        active: subscriptions.filter((sub) => sub.status === "active").length,
        trials: subscriptions.filter((sub) => sub.status === "in_trial").length,
        nonRenewing: subscriptions.filter((sub) => sub.status === "non_renewing").length,
        pastDue: subscriptions.filter((sub) => ["past_due", "unpaid"].includes(sub.status)).length,
        canceled: subscriptions.filter((sub) => sub.status === "cancelled").length,
        collectedCents, refundedCents, netCollectedCents: collectedCents - refundedCents,
        outstandingCents: invoices.reduce((sum, item) => sum + Number(item.amount_due || 0), 0),
        paidInvoices: invoices.filter((item) => item.status === "paid").length,
        failedInvoices: invoices.filter((item) => ["not_paid", "payment_due"].includes(item.status)).length,
      },
      subscriptions: subscriptions.slice(0, 100).map((sub) => ({
        id: sub.id, customerId: sub.customer_id, status: sub.status,
        currency: sub.currency_code || currency, mrrCents: Math.round(recurringMonthly(sub)),
        startedAt: iso(sub.started_at || sub.created_at), trialEndsAt: iso(sub.trial_end),
        renewsAt: iso(sub.next_billing_at || sub.current_term_end),
        items: (sub.subscription_items || []).map((item: any) => item.item_price_id).filter(Boolean),
      })),
      invoices: invoices.slice(0, 100).map((item) => ({
        id: item.id, customerId: item.customer_id, subscriptionId: item.subscription_id,
        status: item.status, currency: item.currency_code || currency,
        totalCents: Number(item.total || 0), paidCents: Number(item.amount_paid || 0), dueCents: Number(item.amount_due || 0),
        date: iso(item.date), dueDate: iso(item.due_date),
      })),
      chargebeeUrl: siteUrl,
    });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Chargebee reporting could not be loaded." }, 500);
  }
});
