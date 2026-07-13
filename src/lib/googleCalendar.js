// Client-side Google Calendar integration.
//
// This uses Google Identity Services' token client, which is designed for
// exactly this situation: a browser-only app with no backend server. The
// trade-off is that there's no refresh token — the access token only lasts
// about an hour and isn't persisted, so reconnecting is a one-tap action
// each new browser session. That's the right trade-off for a private,
// local-first family app with no server to keep secrets on.
//
// To use this, a person needs their own Google Cloud OAuth Client ID with
// the Calendar API enabled (see README for the 5-minute setup). We never
// ship a shared client ID — each family uses their own.

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

let scriptPromise = null;

export function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")));
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function requestGoogleAccessToken(clientId, { silent = false } = {}) {
  await loadGoogleIdentityScript();
  return new Promise((resolve, reject) => {
    if (!clientId || !clientId.trim()) {
      reject(new Error("Missing Google OAuth Client ID"));
      return;
    }
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: SCOPE,
        prompt: silent ? "" : "consent",
        callback: (resp) => {
          if (resp.error) reject(new Error(resp.error));
          else resolve({ accessToken: resp.access_token, expiresIn: Number(resp.expires_in || 3600) });
        },
        error_callback: (err) => reject(new Error(err?.message || "Google sign-in was cancelled")),
      });
      client.requestAccessToken();
    } catch (e) {
      reject(e);
    }
  });
}

function normalizeGoogleEvent(item) {
  if (!item || item.status === "cancelled") return null;
  const rawStart = item.start?.dateTime || (item.start?.date ? `${item.start.date}T00:00:00` : null);
  const rawEnd = item.end?.dateTime || (item.end?.date ? `${item.end.date}T23:59:00` : null);
  if (!rawStart) return null;
  return {
    id: `gcal_${item.id}`,
    title: item.summary || "(No title)",
    start: new Date(rawStart).toISOString(),
    end: new Date(rawEnd || rawStart).toISOString(),
    location: item.location || "",
    memberIds: [],
    source: "google",
    htmlLink: item.htmlLink || null,
  };
}

export async function fetchGoogleCalendarEvents(accessToken, { daysBack = 7, daysForward = 45 } = {}) {
  const timeMin = new Date(Date.now() - daysBack * 86400000).toISOString();
  const timeMax = new Date(Date.now() + daysForward * 86400000).toISOString();
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    timeMin,
    timeMax,
  });

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Calendar returned ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.items || []).map(normalizeGoogleEvent).filter(Boolean);
}

export function revokeGoogleAccessToken(accessToken) {
  if (!accessToken || !window.google?.accounts?.oauth2) return;
  try {
    window.google.accounts.oauth2.revoke(accessToken);
  } catch {
    // best-effort only
  }
}
