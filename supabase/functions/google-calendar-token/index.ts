// Durable Google Calendar tokens.
//
// Supabase issues a short-lived Google `provider_token` (~1h) and never refreshes
// it, so the calendar connection lapses. This function keeps it alive:
//
//   action: "store"  — save the long-lived Google refresh_token for the caller
//                      (the client captures session.provider_refresh_token right
//                      after OAuth consent and posts it here once).
//   action: "token"  — mint a FRESH Google access token from the stored refresh
//                      token, on demand. The client uses this instead of the
//                      expiring provider_token.
//   action: "status" — report whether a refresh token is stored for the caller.
//   action: "disconnect" — forget the stored refresh token.
//
// Required env (Supabase → Edge Functions → Secrets):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  (from the Google Cloud OAuth client)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (provided by Supabase)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Sign in first." }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!url || !serviceKey) return json({ error: "FamOS Google integration is not configured." }, 503);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) return json({ error: "Your session has expired. Please sign in again." }, 401);

    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "token";

    if (action === "store") {
      const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token.trim() : "";
      if (!refreshToken) return json({ error: "No refresh token provided." }, 400);
      const scope = typeof body.scope === "string" ? body.scope.slice(0, 500) : "";
      const { error } = await admin.from("google_oauth_tokens").upsert({
        user_id: user.id,
        refresh_token: refreshToken,
        scope,
        updated_at: new Date().toISOString(),
      });
      if (error) return json({ error: error.message }, 500);
      return json({ stored: true });
    }

    if (action === "status") {
      const { data } = await admin.from("google_oauth_tokens").select("user_id").eq("user_id", user.id).maybeSingle();
      return json({ connected: Boolean(data) });
    }

    if (action === "disconnect") {
      await admin.from("google_oauth_tokens").delete().eq("user_id", user.id);
      return json({ disconnected: true });
    }

    // action === "token": exchange the stored refresh token for a fresh access token.
    if (!clientId || !clientSecret) return json({ error: "Google client credentials are not configured." }, 503);
    const { data: row } = await admin.from("google_oauth_tokens").select("refresh_token").eq("user_id", user.id).maybeSingle();
    if (!row?.refresh_token) return json({ error: "reconnect_required" }, 409);

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: row.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const payload = await tokenResponse.json().catch(() => null);
    if (!tokenResponse.ok || !payload?.access_token) {
      // invalid_grant means the refresh token was revoked/expired — the user
      // must reconnect so we can capture a new one.
      if (payload?.error === "invalid_grant") {
        await admin.from("google_oauth_tokens").delete().eq("user_id", user.id);
        return json({ error: "reconnect_required" }, 409);
      }
      return json({ error: payload?.error_description || payload?.error || "Could not refresh Google token." }, 502);
    }

    return json({ access_token: payload.access_token, expires_in: Number(payload.expires_in || 3600) });
  } catch (error) {
    console.error("google-calendar-token failed", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error." }, 500);
  }
});
