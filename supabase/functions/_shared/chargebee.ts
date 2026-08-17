export const FEATURE_ENV: Record<string, string> = {
  plus: "CHARGEBEE_ITEM_PLUS",
  pro: "CHARGEBEE_ITEM_PRO",
};

export const chargebeeConfig = () => {
  const site = (Deno.env.get("CHARGEBEE_SITE") || "").trim();
  const apiKey = (Deno.env.get("CHARGEBEE_API_KEY") || "").trim();
  if (!site || !apiKey) throw new Error("Chargebee is not configured on the server.");
  return { baseUrl: `https://${site}.chargebee.com/api/v2`, apiKey };
};

export async function chargebeeRequest(path: string, body?: URLSearchParams, method = "POST") {
  const { baseUrl, apiKey } = chargebeeConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${btoa(`${apiKey}:`)}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body?.toString(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error_msg || "Chargebee request failed.");
  return payload;
}

export const featureItemPrice = (feature: string) => {
  const env = FEATURE_ENV[feature];
  const value = env ? Deno.env.get(env) : "";
  if (!value) throw new Error(`Chargebee item price is missing for ${feature}.`);
  return value;
};

export const featureFromItemPrice = (itemPriceId: string) =>
  Object.entries(FEATURE_ENV).find(([, env]) => Deno.env.get(env) === itemPriceId)?.[0] || null;
