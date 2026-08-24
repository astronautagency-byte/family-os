import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function refreshGoogleToken(
  admin: ReturnType<typeof createClient>,
  userId: string,
  refreshToken: string
): Promise<string | null> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID") || "",
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  await admin.from("google_calendar_tokens").update({
    access_token: data.access_token,
    token_expiry: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
  }).eq("user_id", userId);
  return data.access_token;
}

async function getGoogleAccessToken(
  admin: ReturnType<typeof createClient>,
  userId: string
): Promise<string | null> {
  const { data: row } = await admin
    .from("google_calendar_tokens")
    .select("refresh_token, access_token, token_expiry")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row?.refresh_token) return null;
  const isExpired = !row.token_expiry || new Date(row.token_expiry) < new Date(Date.now() + 60000);
  if (!isExpired && row.access_token) return row.access_token;
  return refreshGoogleToken(admin, userId, row.refresh_token);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: userError } = await admin.auth.getUser(accessToken);
    if (userError || !user) return json({ error: "Invalid session" }, 401);

    const { data: membership } = await admin
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership?.household_id) return json({ error: "No household found" }, 400);

    const householdId = membership.household_id;
    const { source, tasks: taskText, list_name } = await request.json();

    // ─── Google Tasks ────────────────────────────────────────────
    if (source === "google_tasks") {
      const googleToken = await getGoogleAccessToken(admin, user.id);
      if (!googleToken) return json({ error: "Google account not connected." }, 400);

      // Fetch task lists
      const listsResp = await fetch("https://tasks.googleapis.com/users/@me/lists", {
        headers: { Authorization: `Bearer ${googleToken}` },
      });
      if (!listsResp.ok) return json({ error: "Could not fetch Google Tasks" }, 502);

      const listsData = await listsResp.json();
      let totalImported = 0;

      for (const gList of listsData.items || []) {
        const tasksResp = await fetch(
          `https://tasks.googleapis.com/lists/${gList.id}/tasks?showCompleted=false&maxResults=100`,
          { headers: { Authorization: `Bearer ${googleToken}` } }
        );
        if (!tasksResp.ok) continue;
        const tasksData = await tasksResp.json();
        const tasks = (tasksData.items || []).filter((t: Record<string, unknown>) => t.title);
        if (!tasks.length) continue;

        const { data: famosList } = await admin
          .from("task_lists")
          .insert({ household_id: householdId, name: gList.title || "Google Tasks", color: "#7F56D9", created_by: user.id })
          .select("id")
          .single();

        if (!famosList) continue;

        const rows = tasks.map((t: Record<string, unknown>) => ({
          household_id: householdId,
          list_id: famosList.id,
          title: t.title as string,
          notes: (t.notes as string) || "",
          source: "google",
          external_id: t.id as string,
          created_by: user.id,
        }));

        const { error } = await admin.from("tasks").insert(rows);
        if (!error) totalImported += rows.length;
      }

      return json({ imported: totalImported, message: `Imported ${totalImported} tasks from Google Tasks.` });
    }

    // ─── CSV / Text import ──────────────────────────────────────
    if (source === "csv" || source === "text") {
      const titles = String(taskText || "")
        .split(/[\n,]+/)
        .map((l: string) => l.trim().replace(/^[-*•]\s*/, ""))
        .filter(Boolean)
        .slice(0, 200);

      if (!titles.length) return json({ error: "No tasks to import." }, 400);

      const { data: famosList } = await admin
        .from("task_lists")
        .insert({ household_id: householdId, name: list_name || "Imported tasks", color: "#7F56D9", created_by: user.id })
        .select("id")
        .single();

      if (!famosList) return json({ error: "Could not create task list." }, 500);

      const rows = titles.map((title: string) => ({
        household_id: householdId,
        list_id: famosList.id,
        title,
        created_by: user.id,
      }));

      const { error } = await admin.from("tasks").insert(rows);
      if (error) return json({ error: error.message }, 500);

      return json({ imported: titles.length, message: `Imported ${titles.length} tasks.` });
    }

    return json({ error: "Unknown source. Use 'google_tasks', 'csv', or 'text'." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
