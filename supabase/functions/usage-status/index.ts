import { authenticatedHousehold, usageAllowance } from "../_shared/usage.ts";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const { admin, householdId } = await authenticatedHousehold(request);
    const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0,10);
    const { data, error } = await admin.from("household_api_usage").select("metric,used_count").eq("household_id", householdId).eq("period_start", periodStart);
    if (error) throw error;
    const used = Object.fromEntries((data || []).map((row: any) => [row.metric, Number(row.used_count || 0)]));
    const nextReset = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString();
    const make = (metric: "famai_queries"|"premium_api_operations") => {
      const limit = usageAllowance(metric); const count = used[metric] || 0;
      return { metric, used: count, limit, remaining: Math.max(0, limit-count) };
    };
    return reply({ periodStart, nextReset, famai: make("famai_queries"), premiumOperations: make("premium_api_operations") });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : "Usage could not be loaded." }, 400); }
});
