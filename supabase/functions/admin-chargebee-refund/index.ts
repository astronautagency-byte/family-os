import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chargebeeRequest } from "../_shared/chargebee.ts";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) return reply({ error: "Sign-in required." }, 401);
    const { data: operator } = await admin.from("admin_users").select("email,is_active").eq("user_id", auth.user.id).maybeSingle();
    if (!operator?.is_active) return reply({ error: "Admin access required." }, 403);
    const { householdId, amountCents, note = "" } = await request.json();
    const amount = Math.round(Number(amountCents));
    if (!householdId || !Number.isFinite(amount) || amount <= 0) return reply({ error: "A positive refund amount is required." }, 400);
    const { data: subscription } = await admin.from("account_subscriptions").select("chargebee_customer_id,currency").eq("household_id", householdId).maybeSingle();
    if (!subscription?.chargebee_customer_id) return reply({ error: "This family does not have a Chargebee customer." }, 404);
    const query = new URLSearchParams({ "customer_id[is]": subscription.chargebee_customer_id, "status[is]": "success", "sort_by[desc]": "date", limit: "25" });
    const transactions = await chargebeeRequest(`/transactions?${query}`, undefined, "GET");
    const transaction = (transactions?.list || []).map((item: any) => item.transaction).find((item: any) => item?.type === "payment" && Number(item?.amount || 0) - Number(item?.amount_unused || 0) >= amount);
    if (!transaction?.id) return reply({ error: "No eligible Chargebee payment can cover this refund." }, 409);
    const form = new URLSearchParams({ amount: String(amount), comment: String(note || "FamOS admin refund") });
    const result = await chargebeeRequest(`/transactions/${encodeURIComponent(transaction.id)}/refund`, form);
    await admin.from("billing_events").insert({ household_id: householdId, event_type: "refund", amount_cents: amount, currency: subscription.currency || "CAD", provider: "chargebee", external_event_id: result?.transaction?.id ? `refund:${result.transaction.id}` : undefined, metadata: { note, sourceTransactionId: transaction.id } });
    await admin.from("admin_audit_log").insert({ admin_user_id: auth.user.id, admin_email: operator.email, action: "issue_chargebee_refund", target_type: "household", target_id: householdId, details: { amountCents: amount, transactionId: transaction.id } });
    return reply({ refunded: true, transactionId: result?.transaction?.id || transaction.id });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Refund could not be completed." }, 500);
  }
});
