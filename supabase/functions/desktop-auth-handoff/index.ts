import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clean = (value: unknown, max = 256) => typeof value === "string" ? value.trim().slice(0, max) : "";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "FamOS desktop sign-in is not configured." }, 503);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await request.json().catch(() => ({}));
    const action = clean(body?.action, 16).toLowerCase();

    if (action === "create") {
      const authorization = request.headers.get("authorization") || "";
      const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
      const state = clean(body?.state, 128);
      const refreshToken = clean(body?.refresh_token, 2048);
      if (!accessToken || !state || !refreshToken) return json({ error: "The desktop sign-in request is incomplete." }, 400);
      if (!/^[A-Za-z0-9_-]{16,128}$/.test(state)) return json({ error: "The desktop sign-in request is invalid." }, 400);

      const { data: auth, error: authError } = await admin.auth.getUser(accessToken);
      if (authError || !auth.user) return json({ error: "Your FamOS session has expired. Please sign in again." }, 401);

      // Remove stale handoffs for this account before creating a new one.
      await admin.from("desktop_auth_handoffs").delete().eq("user_id", auth.user.id);
      const code = randomCode();
      const { error: insertError } = await admin.from("desktop_auth_handoffs").insert({
        code_hash: await sha256(code),
        state_hash: await sha256(state),
        user_id: auth.user.id,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      if (insertError) throw insertError;
      return json({ code, expires_in: 300 });
    }

    if (action === "redeem") {
      const code = clean(body?.code, 256);
      const state = clean(body?.state, 128);
      if (!code || !state) return json({ error: "The desktop sign-in response is incomplete." }, 400);

      // The update is the one-time gate: only the first request can claim the
      // row, even if a callback is delivered twice by the operating system.
      const { data: handoff, error: claimError } = await admin
        .from("desktop_auth_handoffs")
        .update({ used_at: new Date().toISOString() })
        .eq("code_hash", await sha256(code))
        .eq("state_hash", await sha256(state))
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .select("access_token, refresh_token, expires_at")
        .maybeSingle();
      if (claimError || !handoff) return json({ error: "This desktop sign-in link is invalid or has expired. Start again." }, 400);

      const { data: auth, error: authError } = await admin.auth.getUser(handoff.access_token);
      if (authError || !auth.user) return json({ error: "The desktop sign-in session expired. Start again." }, 401);
      await admin.from("desktop_auth_handoffs").delete().eq("code_hash", await sha256(code));

      return json({
        session: {
          access_token: handoff.access_token,
          refresh_token: handoff.refresh_token,
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: auth.user,
        },
      });
    }

    return json({ error: "Unknown desktop authentication action." }, 400);
  } catch (error) {
    console.error("desktop-auth-handoff failed", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected desktop authentication error." }, 500);
  }
});
