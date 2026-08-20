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
    const { customerId } = await request.json();
    if (!customerId) return reply({ error: "Chargebee customer is required." }, 400);
    const form = new URLSearchParams({ "customer[id]": String(customerId), redirect_url: `${Deno.env.get("FRONTEND_URL") || "https://home.fam-os.app"}/admin` });
    const result = await chargebeeRequest("/portal_sessions", form);
    await admin.from("admin_audit_log").insert({ admin_user_id: auth.user.id, admin_email: operator.email, action: "open_chargebee_customer_portal", target_type: "chargebee_customer", target_id: customerId, details: {} });
    return reply({ url: result?.portal_session?.access_url });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Billing portal could not be opened." }, 500);
  }
});
