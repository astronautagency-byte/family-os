import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// ─── Google OAuth token refresh ─────────────────────────────────────

async function refreshGoogleToken(
  admin: ReturnType<typeof createClient>,
  userId: string,
  refreshToken: string
): Promise<string | null> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID") || "",
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenResponse.ok) return null;
  const data = await tokenResponse.json();
  await admin
    .from("google_calendar_tokens")
    .update({
      access_token: data.access_token,
      token_expiry: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    })
    .eq("user_id", userId);
  return data.access_token;
}

async function getGoogleAccessToken(
  admin: ReturnType<typeof createClient>,
  userId: string
): Promise<string | null> {
  const { data: tokenRow } = await admin
    .from("google_calendar_tokens")
    .select("refresh_token, access_token, token_expiry")
    .eq("user_id", userId)
    .maybeSingle();

  if (!tokenRow?.refresh_token) return null;

  const isExpired =
    !tokenRow.token_expiry ||
    new Date(tokenRow.token_expiry) < new Date(Date.now() + 60000);

  if (!isExpired && tokenRow.access_token) return tokenRow.access_token;
  return refreshGoogleToken(admin, userId, tokenRow.refresh_token);
}

// ─── Google Calendar sync ───────────────────────────────────────────

async function syncGoogleCalendar(
  admin: ReturnType<typeof createClient>,
  userId: string,
  householdId: string,
  direction: "pull" | "push" | "both"
) {
  const accessToken = await getGoogleAccessToken(admin, userId);
  if (!accessToken) {
    return { error: "Google Calendar not connected. Connect in Settings → Calendar." };
  }

  const result = { imported: 0, exported: 0, skipped: 0, errors: [] as string[] };

  // PULL: Import events FROM Google INTO FamOS
  if (direction === "pull" || direction === "both") {
    const timeMin = new Date(Date.now() - 30 * 86400000).toISOString(); // 30 days back
    const timeMax = new Date(Date.now() + 180 * 86400000).toISOString(); // 180 days forward

    const calResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=500`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (calResponse.ok) {
      const calData = await calResponse.json();
      for (const event of calData.items || []) {
        if (!event.id || !event.summary || !event.start) { result.skipped++; continue; }

        const { data: existing } = await admin
          .from("events")
          .select("id")
          .eq("household_id", householdId)
          .eq("external_id", event.id)
          .eq("source", "google")
          .maybeSingle();

        if (existing) {
          // Update existing event if changed
          const startTime = event.start?.dateTime || event.start?.date;
          const endTime = event.end?.dateTime || event.end?.date;
          await admin
            .from("events")
            .update({
              title: event.summary,
              description: event.description || "",
              location: event.location || "",
              starts_at: startTime,
              ends_at: endTime || startTime,
            })
            .eq("id", existing.id);
          continue;
        }

        const startTime = event.start?.dateTime || event.start?.date;
        const endTime = event.end?.dateTime || event.end?.date;
        if (!startTime) { result.skipped++; continue; }

        const { error } = await admin.from("events").insert({
          household_id: householdId,
          title: event.summary,
          description: event.description || "",
          location: event.location || "",
          starts_at: startTime,
          ends_at: endTime || startTime,
          source: "google",
          external_id: event.id,
          created_by: userId,
          recurrence: "none",
        });

        if (!error) result.imported++;
        else result.skipped++;
      }
    } else {
      result.errors.push("Could not fetch Google Calendar events");
    }
  }

  // PUSH: Export events FROM FamOS INTO Google
  if (direction === "push" || direction === "both") {
    const { data: localEvents } = await admin
      .from("events")
      .select("id, title, description, location, starts_at, ends_at, source, external_id")
      .eq("household_id", householdId)
      .is("external_id", null) // Only push events not from Google
      .gte("starts_at", new Date().toISOString())
      .limit(50);

    for (const event of localEvents || []) {
      try {
        const googleEvent = {
          summary: event.title,
          description: event.description || "",
          location: event.location || "",
          start: {
            dateTime: event.starts_at,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: event.ends_at || event.starts_at,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        };

        const pushResponse = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json", "Cache-Control": "no-store",
            },
            body: JSON.stringify(googleEvent),
          }
        );

        if (pushResponse.ok) {
          const pushed = await pushResponse.json();
          await admin
            .from("events")
            .update({ source: "google", external_id: pushed.id })
            .eq("id", event.id);
          result.exported++;
        }
      } catch {
        result.errors.push(`Failed to push "${event.title}"`);
      }
    }
  }

  return result;
}

// ─── Main handler ───────────────────────────────────────────────────

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

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

    const body = await request.json();
    const action = body.action || "sync_google";

    if (action === "sync_google") {
      const direction = body.direction || "both";
      const result = await syncGoogleCalendar(admin, user.id, membership.household_id, direction);
      if (result.error) return json({ error: result.error }, 400);
      return json({ ...result, action: "sync_google" });
    }

    if (action === "import_ical") {
      // Retired: no current client uses this legacy arbitrary-URL fetcher.
      // Keep this explicit response for old clients; never resolve or fetch feed_url.
      return json({ error: "Legacy calendar URL import is no longer supported. Connect your calendar in Settings.", code: "legacy_import_retired" }, 410);
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(JSON.stringify({ event: "calendar_sync_error", message }));
    return json({ error: "Calendar request failed. Please try again." }, 500);
  }
});
