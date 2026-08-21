import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type UsageMetric = "famai_queries" | "premium_api_operations";
const limits: Record<UsageMetric, { env: string; fallback: number }> = {
  famai_queries: { env: "CHARGEBEE_FAMAI_QUERY_LIMIT", fallback: 100 },
  // Fallback is intentionally generous but finite: recipe-search is metered
  // per household per month so one heavy family can't burn through the
  // shared Spoonacular key. Paid plans raise this via
  // CHARGEBEE_PREMIUM_OPERATION_LIMIT.
  premium_api_operations: { env: "CHARGEBEE_PREMIUM_OPERATION_LIMIT", fallback: 200 },
};

export const usageAllowance = (metric: UsageMetric) => {
  const config = limits[metric];
  const value = Number(Deno.env.get(config.env) || config.fallback);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : config.fallback;
};

export async function authenticatedHousehold(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) throw new Error("Sign in to continue.");
  const { data: membership } = await admin.from("household_members").select("household_id").eq("user_id", auth.user.id).limit(1).maybeSingle();
  if (!membership?.household_id) throw new Error("Household not found.");
  return { admin, user: auth.user, householdId: membership.household_id as string };
}

export async function consumeUsage(request: Request, metric: UsageMetric) {
  const { admin, user, householdId } = await authenticatedHousehold(request);
  const limit = usageAllowance(metric);
  const { data, error } = await admin.rpc("consume_household_api_usage", { target_household: householdId, target_metric: metric, allowance: limit });
  if (error) throw new Error("Usage could not be verified. Please try again.");
  return { ...data, metric, householdId, user };
}

export const usageLimitResponse = (usage: any, headers: Record<string,string>) => new Response(JSON.stringify({
  error: `Monthly allowance reached. This household can use ${usage.limit} ${usage.metric === "famai_queries" ? "FamAI queries" : "premium API operations"} per month.`,
  code: "USAGE_LIMIT_REACHED", usage,
}), { status: 429, headers: { ...headers, "Content-Type": "application/json" } });
