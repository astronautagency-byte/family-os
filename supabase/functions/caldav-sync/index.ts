import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// ─── CalDAV constants ───────────────────────────────────────────────

const CALDAV_BASE = "https://caldav.icloud.com";

// ─── Simple encryption helpers (AES-GCM via Web Crypto) ─────────────

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("CALDAV_ENCRYPTION_KEY") || "";
  if (!raw) throw new Error("CALDAV_ENCRYPTION_KEY not set");
  const keyBytes = new TextEncoder().encode(raw.padEnd(32, "0").slice(0, 32));
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptPassword(plain: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plain);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  return (
    btoa(String.fromCharCode(...iv)) + "." + btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
  );
}

async function decryptPassword(encrypted: string): Promise<string> {
  const key = await getKey();
  const [ivB64, ctB64] = encrypted.split(".");
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ct
  );
  return new TextDecoder().decode(decrypted);
}

// ─── CalDAV HTTP helpers ────────────────────────────────────────────

function caldavAuth(appleId: string, appPassword: string): string {
  return "Basic " + btoa(`${appleId}:${appPassword}`);
}

async function caldavRequest(
  url: string,
  method: string,
  auth: string,
  body?: string,
  headers?: Record<string, string>
): Promise<Response> {
  return fetch(url, {
    method,
    headers: {
      Authorization: auth,
      "Content-Type": "application/xml; charset=utf-8",
      ...headers,
    },
    body,
  });
}

// ─── CalDAV XML builders ────────────────────────────────────────────

function buildPrincipalPropfind(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal/></d:prop>
</d:propfind>`;
}

function buildCalendarHomePropfind(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:resourcetype/>
    <d:displayname/>
    <c:calendar-description/>
    <d:getctag/>
  </d:prop>
</d:propfind>`;
}

function buildCalendarReport(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${getSyncStartTime()}" end="${getSyncEndTime()}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;
}

function buildEventPut(event: {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  description?: string;
  location?: string;
}): string {
  const now = formatICalDate(new Date());
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//FamOS//CalDAV Sync//EN
BEGIN:VEVENT
UID:${event.uid}
DTSTAMP:${now}
DTSTART:${event.dtstart}
DTEND:${event.dtend}
SUMMARY:${escapeICal(event.summary)}
${event.description ? `DESCRIPTION:${escapeICal(event.description)}` : ""}
${event.location ? `LOCATION:${escapeICal(event.location)}` : ""}
END:VEVENT
END:VCALENDAR`;
}

// ─── iCal helpers ───────────────────────────────────────────────────

function escapeICal(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function unescapeICal(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function formatICalDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
    .replace("Z", "Z");
}

function parseICalDateTime(str: string): string {
  if (!str) return "";
  // Handle DATE-TIME: 20260831T120000Z or 20260831T120000
  const clean = str.replace("Z", "");
  if (clean.length >= 15) {
    const y = clean.slice(0, 4);
    const m = clean.slice(4, 6);
    const d = clean.slice(6, 8);
    const h = clean.slice(9, 11) || "00";
    const mi = clean.slice(11, 13) || "00";
    const s = clean.slice(13, 15) || "00";
    const isUTC = str.endsWith("Z");
    return `${y}-${m}-${d}T${h}:${mi}:${s}${isUTC ? "Z" : ""}`;
  }
  // Handle DATE only: 20260831
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  return str;
}

function getSyncStartTime(): string {
  const d = new Date(Date.now() - 30 * 86400000); // 30 days back
  return formatICalDate(d);
}

function getSyncEndTime(): string {
  const d = new Date(Date.now() + 180 * 86400000); // 180 days forward
  return formatICalDate(d);
}

function parseVCalendarEvents(icalData: string): Array<{
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  description: string;
  location: string;
  etag: string;
}> {
  const events: Array<{
    uid: string;
    summary: string;
    dtstart: string;
    dtend: string;
    description: string;
    location: string;
    etag: string;
  }> = [];

  // Split by VEVENT
  const vevents = icalData.split("BEGIN:VEVENT");

  for (let i = 1; i < vevents.length; i++) {
    const block = vevents[i].split("END:VEVENT")[0];
    const uid = extractField(block, "UID") || `event-${Date.now()}-${i}`;
    const summary = unescapeICal(extractField(block, "SUMMARY") || "Untitled");
    const dtstart = parseICalDateTime(extractField(block, "DTSTART") || "");
    const dtend = parseICalDateTime(
      extractField(block, "DTEND") || extractField(block, "DTSTART") || ""
    );
    const description = unescapeICal(extractField(block, "DESCRIPTION") || "");
    const location = unescapeICal(extractField(block, "LOCATION") || "");

    if (summary && dtstart) {
      events.push({
        uid,
        summary,
        dtstart,
        dtend: dtend || dtstart,
        description,
        location,
        etag: "",
      });
    }
  }

  return events;
}

function extractField(text: string, field: string): string {
  // Handle folded lines (lines starting with space/tab are continuations)
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const regex = new RegExp(`^${field}[^:]*:(.*)$`, "m");
  const match = unfolded.match(regex);
  return match ? match[1].trim() : "";
}

// ─── XML response parsers ───────────────────────────────────────────

function extractPrincipalUrl(xml: string): string | null {
  const match = xml.match(
    /<d:current-user-principal>[\s\S]*?<d:href>([^<]+)<\/d:href>/
  );
  return match ? match[1] : null;
}

function extractCalendarHomeUrl(xml: string): string | null {
  const match = xml.match(/<d:href>([^<]*calendar[^<]*)<\/d:href>/i);
  return match ? match[1] : null;
}

interface CalDavCalendar {
  href: string;
  displayName: string;
  ctag: string;
}

function extractCalendars(xml: string): CalDavCalendar[] {
  const calendars: CalDavCalendar[] = [];
  // Find all response blocks that contain a calendar
  const responses = xml.split("<d:response>");
  for (const resp of responses) {
    if (
      resp.includes("calendar") &&
      resp.includes("resourcetype") &&
      resp.includes("<c:calendar/>")
    ) {
      const hrefMatch = resp.match(/<d:href>([^<]+)<\/d:href>/);
      const nameMatch = resp.match(/<d:displayname>([^<]+)<\/d:displayname>/);
      const ctagMatch = resp.match(/<d:getctag>([^<]+)<\/d:getctag>/);
      if (hrefMatch) {
        calendars.push({
          href: hrefMatch[1],
          displayName: nameMatch ? nameMatch[1] : "Calendar",
          ctag: ctagMatch ? ctagMatch[1] : "",
        });
      }
    }
  }
  return calendars;
}

interface CalDavEvent {
  etag: string;
  calendarData: string;
}

function extractEvents(xml: string): CalDavEvent[] {
  const events: CalDavEvent[] = [];
  const responses = xml.split("<d:response>");
  for (const resp of responses) {
    const etagMatch = resp.match(/<d:getetag>([^<]+)<\/d:getetag>/);
    const dataMatch = resp.match(
      /<c:calendar-data[^>]*>([\s\S]*?)<\/c:calendar-data>/
    );
    if (etagMatch && dataMatch) {
      events.push({
        etag: etagMatch[1].replace(/"/g, ""),
        calendarData: dataMatch[1].trim(),
      });
    }
  }
  return events;
}

// ─── Main sync logic ────────────────────────────────────────────────

async function connectAppleCalendar(
  admin: ReturnType<typeof createClient>,
  userId: string,
  householdId: string,
  appleId: string,
  appPassword: string
) {
  const auth = caldavAuth(appleId, appPassword);

  // Step 1: Discover principal URL
  const principalRes = await caldavRequest(
    `${CALDAV_BASE}/`,
    "PROPFIND",
    auth,
    buildPrincipalPropfind(),
    { Depth: "0" }
  );

  if (!principalRes.ok) {
    return {
      error:
        principalRes.status === 401
          ? "Invalid Apple ID or app-specific password. Generate one at appleid.apple.com → Sign-In and Security → App-Specific Passwords."
          : `Could not connect to iCloud (HTTP ${principalRes.status}). Please try again.`,
    };
  }

  const principalXml = await principalRes.text();
  const principalUrl = extractPrincipalUrl(principalXml);

  if (!principalUrl) {
    return { error: "Could not find your iCloud calendar account." };
  }

  // Step 2: Discover calendar home
  const homeUrl = principalUrl.endsWith("/")
    ? principalUrl
    : `${CALDAV_BASE}${principalUrl}`;

  const homeRes = await caldavRequest(
    homeUrl,
    "PROPFIND",
    auth,
    buildCalendarHomePropfind(),
    { Depth: "1" }
  );

  if (!homeRes.ok) {
    return { error: "Could not access your iCloud calendars." };
  }

  const homeXml = await homeRes.text();
  const calendars = extractCalendars(homeXml);

  if (!calendars.length) {
    return { error: "No calendars found in your iCloud account." };
  }

  // Step 3: Store connection
  const encryptedPassword = await encryptPassword(appPassword);

  // Remove existing connection for this user
  await admin
    .from("caldav_connections")
    .delete()
    .eq("user_id", userId);

  const { data: connection, error: connError } = await admin
    .from("caldav_connections")
    .insert({
      user_id: userId,
      household_id: householdId,
      apple_id: appleId,
      app_password_encrypted: encryptedPassword,
      display_name: "Apple Calendar",
      is_active: true,
    })
    .select("id")
    .single();

  if (connError || !connection) {
    return { error: "Failed to save connection. Please try again." };
  }

  // Step 4: Store calendars
  for (const cal of calendars) {
    await admin.from("caldav_calendars").insert({
      connection_id: connection.id,
      href: cal.href,
      display_name: cal.displayName,
      color: null,
      is_selected: true,
      is_shared: false,
      ctag: cal.ctag,
    });
  }

  return {
    connected: true,
    calendars: calendars.map((c) => ({
      href: c.href,
      displayName: c.displayName,
    })),
  };
}

async function syncCalDavEvents(
  admin: ReturnType<typeof createClient>,
  userId: string,
  householdId: string,
  direction: "pull" | "push" | "both"
) {
  // Get active connection
  const { data: connection } = await admin
    .from("caldav_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!connection) {
    return { error: "No Apple Calendar connected." };
  }

  const appPassword = await decryptPassword(connection.app_password_encrypted);
  const auth = caldavAuth(connection.apple_id, appPassword);

  // Get selected calendars
  const { data: calendars } = await admin
    .from("caldav_calendars")
    .select("*")
    .eq("connection_id", connection.id)
    .eq("is_selected", true);

  const result = { imported: 0, exported: 0, skipped: 0, errors: [] as string[] };

  // PULL: Import events FROM iCloud INTO FamOS
  if (direction === "pull" || direction === "both") {
    for (const cal of calendars || []) {
      try {
        const calUrl = cal.href.startsWith("http")
          ? cal.href
          : `${CALDAV_BASE}${cal.href}`;

        const reportRes = await caldavRequest(
          calUrl,
          "REPORT",
          auth,
          buildCalendarReport(),
          { Depth: "1" }
        );

        if (!reportRes.ok) {
          result.errors.push(`Could not read ${cal.display_name}`);
          continue;
        }

        const reportXml = await reportRes.text();
        const caldavEvents = extractEvents(reportXml);

        for (const ce of caldavEvents) {
          const parsed = parseVCalendarEvents(ce.calendarData);
          for (const evt of parsed) {
            if (!evt.summary || !evt.dtstart) {
              result.skipped++;
              continue;
            }

            // Check if event already exists
            const { data: existing } = await admin
              .from("events")
              .select("id")
              .eq("household_id", householdId)
              .eq("external_id", evt.uid)
              .eq("source", "apple")
              .maybeSingle();

            if (existing) {
              // Update if changed
              await admin
                .from("events")
                .update({
                  title: evt.summary,
                  description: evt.description,
                  location: evt.location,
                  starts_at: evt.dtstart,
                  ends_at: evt.dtend || evt.dtstart,
                })
                .eq("id", existing.id);
              continue;
            }

            // Insert new event
            const { error } = await admin.from("events").insert({
              household_id: householdId,
              title: evt.summary,
              description: evt.description,
              location: evt.location,
              starts_at: evt.dtstart,
              ends_at: evt.dtend || evt.dtstart,
              source: "apple",
              external_id: evt.uid,
              created_by: userId,
              recurrence: "none",
            });

            if (!error) result.imported++;
            else result.skipped++;
          }
        }
      } catch (err) {
        result.errors.push(`Sync error for ${cal.display_name}: ${err}`);
      }
    }
  }

  // PUSH: Export events FROM FamOS INTO iCloud
  if (direction === "push" || direction === "both") {
    const { data: localEvents } = await admin
      .from("events")
      .select("id, title, description, location, starts_at, ends_at, source, external_id")
      .eq("household_id", householdId)
      .is("external_id", null)
      .gte("starts_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(50);

    // Use the first selected calendar for pushing
    const targetCal = calendars?.[0];
    if (!targetCal) {
      result.errors.push("No calendar selected for pushing events");
      return result;
    }

    const calUrl = targetCal.href.startsWith("http")
      ? targetCal.href
      : `${CALDAV_BASE}${targetCal.href}`;

    for (const event of localEvents || []) {
      try {
        const uid = `famos-${event.id}@fam-os.app`;
        const dtstart = formatICalDate(new Date(event.starts_at));
        const dtend = formatICalDate(
          new Date(event.ends_at || event.starts_at)
        );

        const icalBody = buildEventPut({
          uid,
          summary: event.title,
          dtstart,
          dtend,
          description: event.description || undefined,
          location: event.location || undefined,
        });

        const eventUrl = `${calUrl}${uid}.ics`;

        const putRes = await caldavRequest(eventUrl, "PUT", auth, icalBody);

        if (putRes.ok || putRes.status === 201 || putRes.status === 204) {
          await admin
            .from("events")
            .update({ source: "apple", external_id: uid })
            .eq("id", event.id);
          result.exported++;
        }
      } catch (err) {
        result.errors.push(`Failed to push "${event.title}": ${err}`);
      }
    }
  }

  // Update last synced timestamp
  await admin
    .from("caldav_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", connection.id);

  return result;
}

// ─── Edge Function handler ──────────────────────────────────────────

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Sign in to manage calendars.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Your session has expired.");

    // Admin client for DB operations
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await request.json();
    const { action } = body;

    // Get household
    const { data: membership } = await admin
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) throw new Error("No household found.");

    switch (action) {
      case "connect": {
        const { appleId, appPassword } = body;
        if (!appleId || !appPassword) {
          return json({ error: "Apple ID and app-specific password required." }, 400);
        }
        const result = await connectAppleCalendar(
          admin,
          user.id,
          membership.household_id,
          appleId,
          appPassword
        );
        return json(result, result.error ? 400 : 200);
      }

      case "disconnect": {
        await admin
          .from("caldav_calendars")
          .delete()
          .in(
            "connection_id",
            (
              await admin
                .from("caldav_connections")
                .select("id")
                .eq("user_id", user.id)
            ).data?.map((c: { id: string }) => c.id) || []
          );

        await admin.from("caldav_connections").delete().eq("user_id", user.id);

        return json({ disconnected: true });
      }

      case "list-calendars": {
        const { data: connection } = await admin
          .from("caldav_connections")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .single();

        if (!connection) return json({ calendars: [] });

        const { data: calendars } = await admin
          .from("caldav_calendars")
          .select("*")
          .eq("connection_id", connection.id);

        return json({ calendars: calendars || [] });
      }

      case "toggle-calendar": {
        const { calendarId, selected } = body;
        await admin
          .from("caldav_calendars")
          .update({ is_selected: selected })
          .eq("id", calendarId);
        return json({ updated: true });
      }

      case "sync": {
        const { direction = "both" } = body;
        const result = await syncCalDavEvents(
          admin,
          user.id,
          membership.household_id,
          direction
        );
        return json(result, result.error ? 400 : 200);
      }

      case "status": {
        const { data: connection } = await admin
          .from("caldav_connections")
          .select("id, apple_id, is_active, last_synced_at")
          .eq("user_id", user.id)
          .single();

        return json({
          connected: !!connection,
          appleId: connection?.apple_id || null,
          lastSynced: connection?.last_synced_at || null,
        });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return json({ error: err.message || "Internal error" }, 500);
  }
});
