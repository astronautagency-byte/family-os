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
const SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly";

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

export async function requestGoogleAccessToken(clientId, { silent = false, timeoutMs = 90_000 } = {}) {
  await loadGoogleIdentityScript();
  return new Promise((resolve, reject) => {
    if (!clientId || !clientId.trim()) {
      reject(new Error("Missing Google OAuth Client ID"));
      return;
    }
    // GIS token-client callbacks are NOT guaranteed to fire on popup
    // dismissal: if the user closes the consent window without completing
    // the flow, neither `callback` nor `error_callback` runs and the
    // promise hangs forever — leaving the UI stuck on "Connecting…".
    // Two safety nets rescue us:
    //   1. visibilitychange — focus returning to the page (popup gone)
    //      is treated as "user cancelled" after a brief grace period
    //      that lets a racing success callback win.
    //   2. A 90-second overall timeout, after which we reject.
    let settled = false;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
    const settle = (handler, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      handler(value);
    };
    const timer = setTimeout(
      () => settle(reject, new Error("Google sign-in timed out. Close any popups and try again.")),
      timeoutMs
    );
    // The GIS popup steals window focus from the parent page when it opens
    // (`blur` here) and returns focus when the user finishes or dismisses
    // the popup (`focus` here). On desktop, `visibilitychange` does NOT
    // reliably fire for small popups, so we listen for the focus events
    // instead. After a brief grace period that lets a racing success
    // callback win, a focus return counts as a user-initiated cancellation.
    let popupOpened = false;
    const onFocus = () => {
      if (settled || !popupOpened) return;
      setTimeout(() => settle(reject, new Error("Google sign-in was cancelled.")), 600);
    };
    const onBlur = () => { popupOpened = true; };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: SCOPE,
        prompt: silent ? "" : "consent",
        callback: (resp) => {
          if (resp?.error) settle(reject, new Error(resp.error));
          else settle(resolve, { accessToken: resp.access_token, expiresIn: Number(resp.expires_in || 3600) });
        },
        error_callback: (err) => settle(reject, new Error(err?.message || "Google sign-in was cancelled")),
      });
      // requestAccessToken throws synchronously when the popup is blocked
      // by the browser, so the outer catch here handles that without
      // waiting on the visibility race above.
      try {
        client.requestAccessToken();
      } catch (popupError) {
        settle(reject, popupError);
      }
    } catch (e) {
      settle(reject, e);
    }
  });
}

function normalizeGoogleEvent(item, calendar = { id: "primary", summary: "Google Calendar" }) {
  if (!item || item.status === "cancelled") return null;
  const rawStart = item.start?.dateTime || (item.start?.date ? `${item.start.date}T00:00:00` : null);
  const rawEnd = item.end?.dateTime || (item.end?.date ? `${item.end.date}T23:59:00` : null);
  if (!rawStart) return null;
  return {
    id: `gcal_${encodeURIComponent(calendar.id)}_${item.id}`,
    title: item.summary || "(No title)",
    start: new Date(rawStart).toISOString(),
    end: new Date(rawEnd || rawStart).toISOString(),
    location: item.location || "",
    memberIds: [],
    source: "google",
    calendarId: calendar.id,
    calendarName: calendar.summary,
    color: calendar.backgroundColor || "#6759D9",
    calendarAccessRole: calendar.accessRole || "reader",
    htmlLink: item.htmlLink || null,
  };
}

export async function fetchGoogleCalendars(accessToken) {
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Google Calendar list returned ${res.status}`);
  const data = await res.json();
  return (data.items || []).filter(item => !item.hidden).map(item => ({ id:item.id, summary:item.summaryOverride||item.summary||"Untitled calendar", backgroundColor:item.backgroundColor||"#6759D9", foregroundColor:item.foregroundColor||"#ffffff", primary:Boolean(item.primary), selected:item.selected!==false, accessRole:item.accessRole||"reader" }));
}

export async function fetchGoogleCalendarEvents(accessToken, calendars, { daysBack = 7, daysForward = 45 } = {}) {
  const timeMin = new Date(Date.now() - daysBack * 86400000).toISOString();
  const timeMax = new Date(Date.now() + daysForward * 86400000).toISOString();
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    timeMin,
    timeMax,
  });

  const chosen = calendars?.length ? calendars : [{ id:"primary", summary:"Google Calendar", primary:true, accessRole:"owner" }];
  const groups = await Promise.all(chosen.map(async calendar => {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) { const body=await res.text().catch(()=>""); throw new Error(`${calendar.summary} returned ${res.status}: ${body.slice(0,120)}`); }
    const data=await res.json(); return (data.items||[]).map(item=>normalizeGoogleEvent(item,calendar)).filter(Boolean);
  }));
  return groups.flat().sort((a,b)=>a.start.localeCompare(b.start));
}

export async function createGoogleCalendarEvent(accessToken, event, calendar = { id:"primary", summary:"Google Calendar", accessRole:"owner" }) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: event.title,
      location: event.location || undefined,
      description: event.notes || undefined,
      start: { dateTime: event.start, timeZone },
      end: { dateTime: event.end, timeZone },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Calendar returned ${res.status}: ${body.slice(0, 200)}`);
  }
  return normalizeGoogleEvent(await res.json(), calendar);
}

export function revokeGoogleAccessToken(accessToken) {
  if (!accessToken || !window.google?.accounts?.oauth2) return;
  try {
    window.google.accounts.oauth2.revoke(accessToken);
  } catch {
    // best-effort only
  }
}
