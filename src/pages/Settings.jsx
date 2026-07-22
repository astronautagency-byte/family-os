import { useEffect, useState } from "react";
import { AlertCircle, Bell, Bot, CalendarDays, CheckCircle2, ExternalLink, Eye, EyeOff, ImagePlus, Info, Link2, MapPin, Megaphone, Pencil, Phone, Plus, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Trash2, Upload, Users, Utensils } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { useAuth } from "../context/AuthContext";
import { Avatar, Card, Modal, PrimaryButton, SecondaryButton, TextField } from "../components/ui";
import ConfirmAction from "../components/ConfirmAction";
import PageHeader from "../components/PageHeader";
import { FAMILY_COLORS } from "../data/mockData";
import { AVATAR_PRESETS } from "../data/avatarLibrary";
import { PRICING_PLAN, formatMoney } from "../data/pricingPlan";
import { supabase } from "../lib/supabase";
import AddressAutocomplete from "../components/AddressAutocomplete";
import { formatPhoneInput, isValidPhoneNumber, normalizePhoneE164 } from "../utils/phone";
import { clearAllFamosCache, countFamosCacheEntries } from "../lib/eventSearchCache";

const HOUSEHOLD_DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Nut-free", "Shellfish-free", "Low sugar"];

function initialsFrom(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";
}

function resizeAvatarImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = 360;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        const sourceSize = Math.min(image.width, image.height);
        const sourceX = (image.width - sourceSize) / 2;
        const sourceY = (image.height - sourceSize) / 2;
        context.fillStyle = "#fff";
        context.fillRect(0, 0, size, size);
        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function GoogleCalendarCard() {
  const {
    googleClientId, setGoogleClientId,
    googleConnected, googleStatus, googleError, googleLastSynced, googleEvents, googleCalendars, selectedGoogleCalendarIds, sharedGoogleCalendarIds,
    googleUsesAccount,
    connectGoogleCalendar, syncGoogleCalendarNow, disconnectGoogleCalendar, toggleGoogleCalendar, toggleGoogleCalendarSharing,
  } = useFamily();
  const [showSetup, setShowSetup] = useState(!googleClientId);

  const isBusy = googleStatus === "connecting" || googleStatus === "syncing";

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
          <CalendarDays size={18} color="var(--color-ink)" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[14.5px] text-[var(--color-ink)]">Google Calendar</p>
          <p className="text-[12.5px] text-[var(--color-ink-soft)]">
            {googleConnected
              ? googleLastSynced
                ? `Synced · ${googleEvents.length} event${googleEvents.length === 1 ? "" : "s"} imported`
                : "Connected"
              : "Not connected"}
          </p>
        </div>
        {googleConnected && <CheckCircle2 size={18} color="var(--color-good)" />}
      </div>

      {googleError && (
        <div className="flex items-start gap-2 rounded-xl bg-[var(--color-warn-soft)] px-3 py-2.5 mb-3">
          <AlertCircle size={14} color="var(--color-warn)" className="mt-0.5 shrink-0" />
          <p className="text-[12.5px] text-[var(--color-warn)] leading-snug">{googleError}</p>
        </div>
      )}

      {googleConnected && googleCalendars.length > 0 && (
        <div className="google-calendar-picker">
          <div><strong>Your Google calendars</strong><span>{selectedGoogleCalendarIds.length} connected</span></div>
          <p className="google-calendar-help">Connect as many calendars as you need, then choose which ones the household can see.</p>
          <ul>
            {googleCalendars.map((calendar) => {
              const connected = selectedGoogleCalendarIds.includes(calendar.id);
              const shared = sharedGoogleCalendarIds.includes(calendar.id);
              return (
                <li key={calendar.id} className={connected ? "is-connected" : ""}>
                  <button className="google-calendar-main" onClick={() => toggleGoogleCalendar(calendar.id)} disabled={isBusy} aria-pressed={connected}>
                    <i style={{ backgroundColor: calendar.backgroundColor }} />
                    <span>
                      <b>{calendar.summary}</b>
                      <small>{calendar.primary ? "Primary calendar" : calendar.accessRole === "reader" ? "Read only" : "Can add events"}</small>
                    </span>
                    <em>{connected ? <CheckCircle2 /> : "Connect"}</em>
                  </button>
                  <button
                    className={`google-calendar-visibility ${shared ? "is-shared" : ""}`}
                    onClick={() => toggleGoogleCalendarSharing(calendar.id)}
                    disabled={isBusy || !connected}
                    aria-pressed={shared}
                    title={connected ? "Change household visibility" : "Connect this calendar first"}
                  >
                    {shared ? <Users size={15} /> : <EyeOff size={15} />}
                    <span>{shared ? "Shared with household" : "Private to you"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {!googleUsesAccount && (showSetup || !googleClientId) && !googleConnected && (
        <div className="mb-3">
          <TextField
            label="Google OAuth Client ID"
            placeholder="xxxxxxxx.apps.googleusercontent.com"
            value={googleClientId}
            onChange={(e) => setGoogleClientId(e.target.value)}
          />
          <p className="text-[11.5px] text-[var(--color-ink-faint)] leading-relaxed -mt-2">
            One-time setup: create a free OAuth Client ID in Google Cloud Console with the Calendar API enabled,
            using this app's URL as an authorized origin. Full steps are in the README. Events you explicitly add
            to Google Calendar from FamOS can be written back to any selected calendar where you have write access.
          </p>
        </div>
      )}

      {googleConnected ? (
        <div className="flex gap-2">
          <SecondaryButton onClick={disconnectGoogleCalendar} disabled={isBusy}>
            Disconnect
          </SecondaryButton>
          <PrimaryButton onClick={(googleStatus === "error" || googleStatus === "expired") ? connectGoogleCalendar : syncGoogleCalendarNow} disabled={isBusy}>
            {googleStatus === "syncing" ? "Syncing…" : (googleStatus === "error" || googleStatus === "expired") ? "Reconnect Google" : "Sync now"}
          </PrimaryButton>
        </div>
      ) : (
        <PrimaryButton onClick={connectGoogleCalendar} disabled={isBusy || (!googleUsesAccount && !googleClientId.trim())}>
          {googleStatus === "connecting" ? "Connecting…" : googleUsesAccount ? "Connect with Google" : "Connect Google Calendar"}
        </PrimaryButton>
      )}

      {!googleUsesAccount && googleClientId && !googleConnected && !showSetup && (
        <button onClick={() => setShowSetup(true)} className="text-[12px] font-medium text-[var(--color-accent)] mt-2">
          Edit Client ID
        </button>
      )}
    </Card>
  );
}

function CalendarFeedsCard() {
  const {
    calendarFeeds, calendarFeedStatus, calendarFeedError,
    addCalendarFeed, importCalendarFile, syncCalendarFeed, removeCalendarFeed,
  } = useFamily();
  const [adding, setAdding] = useState(false);
  const [provider, setProvider] = useState("apple");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const busy = calendarFeedStatus === "syncing";

  const connect = async () => {
    if (!url.trim()) return;
    try {
      await addCalendarFeed({ provider, name, url });
      setName("");
      setUrl("");
      setAdding(false);
    } catch {
      // The shared context displays a provider-specific connection error.
    }
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileBusy(true);
    try {
      await importCalendarFile({ provider, name, fileName: file.name, text: await file.text() });
      setName("");
      setAdding(false);
    } catch {
      // The shared context displays a user-friendly import error.
    } finally {
      setFileBusy(false);
      event.target.value = "";
    }
  };

  return (
    <Card className="p-4 mt-3">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
          <Link2 size={18} color="var(--color-ink)" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[14.5px] text-[var(--color-ink)]">Apple, Outlook & iCal</p>
          <p className="text-[12.5px] text-[var(--color-ink-soft)]">Sync read-only published calendar feeds</p>
        </div>
        {calendarFeeds.length > 0 && <CheckCircle2 size={18} color="var(--color-good)" />}
      </div>

      {calendarFeeds.length > 0 && (
        <ul className="mb-3 border-y border-[var(--color-border)]">
          {calendarFeeds.map((feed) => (
            <li key={feed.id} className="flex items-center gap-2 py-2.5 border-b border-[var(--color-border)] last:border-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: feed.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium truncate">{feed.name}</p>
                <p className="text-[11px] text-[var(--color-ink-faint)]">{feed.source === "file" ? `Imported from ${feed.fileName || "calendar file"}` : feed.lastSynced ? `Synced ${new Date(feed.lastSynced).toLocaleString()}` : "Not synced yet"}</p>
              </div>
              {feed.source !== "file" && <button disabled={busy} onClick={() => syncCalendarFeed(feed.id)} className="p-2 text-[var(--color-accent)] disabled:opacity-40" aria-label={`Sync ${feed.name}`}><RefreshCw size={15} className={busy ? "animate-spin" : ""} /></button>}
              <button disabled={busy} onClick={() => removeCalendarFeed(feed.id)} className="p-2 text-[var(--color-ink-faint)] disabled:opacity-40" aria-label={`Remove ${feed.name}`}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}

      {calendarFeedError && (
        <div className="flex items-start gap-2 rounded-xl bg-[var(--color-warn-soft)] px-3 py-2.5 mb-3">
          <AlertCircle size={14} color="var(--color-warn)" className="mt-0.5 shrink-0" />
          <p className="text-[12px] text-[var(--color-warn)] leading-snug">{calendarFeedError}</p>
        </div>
      )}

      {adding ? (
        <div>
          <label className="block text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-1.5">Calendar type</label>
          <select value={provider} onChange={(event) => setProvider(event.target.value)} className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 text-[14px] mb-3">
            <option value="apple">Apple / iCloud</option>
            <option value="outlook">Outlook / Microsoft 365</option>
            <option value="ical">Other iCal feed</option>
          </select>
          <TextField label="Calendar name (optional)" placeholder="e.g. Kat's work calendar" value={name} onChange={(event) => setName(event.target.value)} />
          <label className="calendar-file-import"><input type="file" accept=".ics,text/calendar" onChange={importFile} disabled={fileBusy}/><Upload/><strong>{fileBusy ? "Importing…" : "Choose calendar export"}</strong><span>Select an .ics file from Apple Calendar, Outlook, or another calendar app.</span></label>
          <button className="advanced-calendar-toggle" onClick={() => setShowAdvanced((value) => !value)}>{showAdvanced ? "Hide advanced sync" : "Advanced: sync with a subscription link"}</button>
          {showAdvanced && <div className="advanced-calendar-fields"><TextField label="Published calendar URL" placeholder="https://…/calendar.ics or webcal://…" value={url} onChange={(event) => setUrl(event.target.value)} inputMode="url" /><p>Use this only if your calendar provider gives you a published or subscription link.</p><PrimaryButton disabled={busy || !url.trim()} onClick={connect}>{busy ? "Connecting…" : "Connect synced feed"}</PrimaryButton></div>}
          <SecondaryButton disabled={busy || fileBusy} onClick={() => setAdding(false)}>Cancel</SecondaryButton>
        </div>
      ) : (
        <SecondaryButton onClick={() => setAdding(true)} className="flex items-center justify-center gap-2"><Plus size={15} /> Add calendar feed</SecondaryButton>
      )}
    </Card>
  );
}

function DeliveryTestCard() {
  const { user } = useAuth();
  const STORAGE_KEY = "famos-delivery-test:last-run";
  const PHONE_KEY = "famos-delivery-test:phone";
  const RESULTS_KEY = "famos-delivery-test:last-results";
  const HEALTH_EVENT = "famos:delivery-test-updated";
  const [phone, setPhone] = useState(() => {
    try { return localStorage.getItem(PHONE_KEY) || ""; } catch { return ""; }
  });
  const [results, setResults] = useState(() => {
    try {
      const cached = localStorage.getItem(RESULTS_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [busy, setBusy] = useState(false);
  const [lastRunAt, setLastRunAt] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
  });
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!lastRunAt) { setSecondsLeft(0); return undefined; }
    const computeRemaining = () => {
      const elapsed = Math.floor((Date.now() - new Date(lastRunAt).getTime()) / 1000);
      return Math.max(0, 60 - elapsed);
    };
    setSecondsLeft(computeRemaining());
    const tick = window.setInterval(() => setSecondsLeft(computeRemaining()), 1000);
    return () => window.clearInterval(tick);
  }, [lastRunAt]);

  const isThrottled = secondsLeft > 0;

  const run = async () => {
    if (busy || isThrottled) return;
    setBusy(true);
    setError("");
    try {
      const normalizedPhone = phone.trim().replace(/[^\d+]/g, "");
      const { data, error: functionError } = await supabase.functions.invoke("test-delivery", {
        body: {
          testPhone: normalizedPhone.startsWith("+") ? normalizedPhone : normalizedPhone ? `+${normalizedPhone}` : "",
        },
      });
      if (functionError) {
        const status = functionError?.context?.status;
        throw new Error(status ? `${functionError.message || "Delivery test failed"} (HTTP ${status})` : (functionError.message || "Delivery test failed"));
      }
      const nextResults = Array.isArray(data?.results) ? data.results : [];
      setResults(nextResults);
      const now = new Date().toISOString();
      setLastRunAt(now);
      try {
        localStorage.setItem(STORAGE_KEY, now);
        localStorage.setItem(PHONE_KEY, phone);
        localStorage.setItem(RESULTS_KEY, JSON.stringify(nextResults));
        // Let the header badge (and any future listener) re-read immediately.
        window.dispatchEvent(new Event(HEALTH_EVENT));
      } catch { /* storage full / disabled — fine */ }
    } catch (e) {
      setError(e.message || "Delivery test failed.");
    } finally {
      setBusy(false);
    }
  };

  const channelLabel = {
    aws_ses: "Amazon SES",
    resend: "Resend",
    supabase_smtp: "Supabase SMTP",
    aws_sns: "Amazon SNS",
    textbelt: "Textbelt",
    sms: "SMS",
  };
  const statusColor = (status) => {
    if (status === "sent") return "var(--color-good)";
    // rate_limited is "wait N seconds" — calmer amber than hard failures
    if (status === "rate_limited") return "#b8761f";
    if (status === "blocked" || status === "paused") return "var(--color-warn)";
    if (status === "failed" || status === "unreachable") return "var(--color-warn)";
    if (status === "skipped" || status === "not_configured") return "var(--color-ink-faint)";
    return "var(--color-ink)";
  };

  // Per-channel "Fix it" deep links — turn the red status pill into a one-tap
  // jump into the right console for that channel + region. Returns null when
  // the status is "sent" (nothing to fix) or "skipped" (input not given).
  const fixLinkFor = (channel, status, region) => {
    if (!status || status === "sent" || status === "skipped") return null;
    const safeRegion = region || "ca-central-1";
    switch (channel) {
      case "aws_ses":
        if (status === "blocked") return { url: `https://console.aws.amazon.com/ses/home?region=${safeRegion}#/verified-identities`, label: "Verify recipient in SES" };
        if (status === "paused") return { url: `https://console.aws.amazon.com/ses/home?region=${safeRegion}#/account`, label: "Re-enable SES sending" };
        return { url: `https://console.aws.amazon.com/ses/home?region=${safeRegion}`, label: "Open SES console" };
      case "aws_sns":
        return { url: `https://console.aws.amazon.com/pinpoint/home?region=${safeRegion}#/end-user-messaging/sms`, label: "Verify SMS in End User Messaging" };
      case "resend":
        if (status === "not_configured") return { url: "https://resend.com/api-keys", label: "Add RESEND_API_KEY" };
        return { url: "https://resend.com/dashboard", label: "Open Resend dashboard" };
      case "supabase_smtp":
        return { url: "https://supabase.com/dashboard/project/_/auth/users", label: "Open Supabase Auth" };
      case "textbelt":
        return { url: "https://textbelt.com/", label: "Check Textbelt quota" };
      default:
        return null;
    }
  };

  return (
    <Card className="p-4 mt-3">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
          <Megaphone size={18} color="var(--color-ink)" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[14.5px] text-[var(--color-ink)]">Delivery channels</p>
          <p className="text-[12.5px] text-[var(--color-ink-soft)]">Fire a real test through every configured email + SMS provider.</p>
        </div>
      </div>
      <TextField
        label="Phone for SMS test (optional)"
        placeholder="+1 (416) 555-0123"
        value={phone}
        onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
        inputMode="tel"
      />
      <p className="text-[11.5px] text-[var(--color-ink-faint)] -mt-2 mb-2">Email always tests your account email ({user?.email || "—"}). Add a mobile for a SMS round-trip.</p>
      <p className="text-[11px] text-[var(--color-ink-faint)] leading-snug mb-2">
        You may receive up to 3 inbound test emails (one per configured email provider) plus 1 SMS, all tagged <code>[FamOS test]</code> or <q>FamOS delivery-channel self-test</q> so you can filter them out of your inbox.
      </p>
      {error && <p className="text-[12px] text-[var(--color-warn)] mb-2">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton onClick={run} disabled={busy || isThrottled}>
          {busy ? "Running…" : isThrottled ? `Wait ${secondsLeft}s` : "Run delivery test"}
        </PrimaryButton>
        {lastRunAt && <small className="text-[11.5px] text-[var(--color-ink-faint)]">Last run {new Date(lastRunAt).toLocaleString()}</small>}
      </div>
      {results && (
        <ul className="mt-3 space-y-1.5">
          {results.map((result) => (
            <li key={result.channel} className="flex items-start gap-2.5 rounded-xl bg-[var(--color-surface-sunken)] p-2.5 border border-[var(--color-border)]">
              <span className="w-2 h-2 mt-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColor(result.status) }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <strong className="text-[12.5px] text-[var(--color-ink)]">{channelLabel[result.channel] || result.channel}</strong>
                  <em className="text-[11px] not-italic" style={{ color: statusColor(result.status) }}>{result.status.replace(/_/g, " ")}</em>
                </div>
                {result.error && <small className="text-[11.5px] text-[var(--color-ink-soft)] block leading-snug mt-0.5">{result.error}</small>}
                {result.message && !result.error && <small className="text-[11.5px] text-[var(--color-ink-soft)] block leading-snug mt-0.5">{result.message}</small>}
                {!result.error && result.status === "sent" && result.kind === "email" && <small className="text-[11px] text-[var(--color-ink-faint)] block mt-0.5">Check your inbox for a [FamOS test] message</small>}
                {!result.error && result.status === "sent" && result.kind === "sms" && <small className="text-[11px] text-[var(--color-ink-faint)] block mt-0.5">Check your phone for the FamOS delivery-test text</small>}
                {(result.region || result.latency_ms !== undefined) && (
                  <small className="text-[10.5px] text-[var(--color-ink-faint)] block mt-0.5">
                    {result.region ? `region: ${result.region}` : ""}
                    {result.region && result.latency_ms !== undefined ? " · " : ""}
                    {result.latency_ms !== undefined ? `${result.latency_ms} ms` : ""}
                  </small>
                )}
                {(() => {
                  const fixLink = fixLinkFor(result.channel, result.status, result.region);
                  return fixLink ? (
                    <a
                      href={fixLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-[var(--color-accent)] underline mt-1.5 inline-block"
                    >
                      {fixLink.label} →
                    </a>
                  ) : null;
                })()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Channel-health summary for the PageHeader badge ──────────────────
// Promoted out of DeliveryTestCard so the header shows the same state
// without the user opening the card. Reads from the same localStorage
// keys DeliveryTestCard writes to, and re-reads whenever it dispatches
// `famos:delivery-test-updated` (or any storage event fires).
const DELIVERY_HEALTH_EVENT = "famos:delivery-test-updated";
const DELIVERY_STORAGE_RUN_KEY = "famos-delivery-test:last-run";
const DELIVERY_STORAGE_RESULTS_KEY = "famos-delivery-test:last-results";
const DELIVERY_FAILURE_STATUSES = new Set(["failed", "blocked", "paused", "unreachable", "rate_limited", "not_configured"]);

function formatRelativeShort(date) {
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function readDeliveryHealth() {
  if (typeof window === "undefined") return { state: "unknown" };
  try {
    const lastRun = window.localStorage.getItem(DELIVERY_STORAGE_RUN_KEY);
    const resultsRaw = window.localStorage.getItem(DELIVERY_STORAGE_RESULTS_KEY);
    if (!lastRun || !resultsRaw) return { state: "unknown" };
    const parsed = JSON.parse(resultsRaw);
    if (!Array.isArray(parsed) || parsed.length === 0) return { state: "unknown", lastRun };
    const failing = parsed.filter((row) => !row || !row.status || DELIVERY_FAILURE_STATUSES.has(row.status));
    if (failing.length === 0) return { state: "good", lastRun, totalChannels: parsed.length };
    return { state: "failing", lastRun, totalChannels: parsed.length, failingCount: failing.length };
  } catch {
    return { state: "unknown" };
  }
}

function useDeliveryHealth() {
  const [health, setHealth] = useState(readDeliveryHealth);
  useEffect(() => {
    const refresh = () => setHealth(readDeliveryHealth());
    window.addEventListener(DELIVERY_HEALTH_EVENT, refresh);
    window.addEventListener("storage", refresh);
    // Re-tick so the "last run Xm ago" string stays fresh while the user
    // lingers on Settings without retesting.
    const tick = window.setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener(DELIVERY_HEALTH_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.clearInterval(tick);
    };
  }, []);
  return health;
}

function DeliveryHealthBadge({ health }) {
  if (!health) return null;
  if (health.state === "good") {
    const total = health.totalChannels || 0;
    return (
      <span
        className="page-header-health"
        data-state="good"
        role="status"
        aria-live="polite"
        title={`Every delivery channel sent the last test. Last run: ${new Date(health.lastRun).toLocaleString()}`}
      >
        <span className="ph-dot" aria-hidden="true" />
        <strong>Delivery OK</strong>
        {total > 0 && <small>· all {total} channel{total === 1 ? "" : "s"}</small>}
        {health.lastRun && <small>· last run {formatRelativeShort(health.lastRun)}</small>}
      </span>
    );
  }
  if (health.state === "failing") {
    const total = health.totalChannels || 0;
    const failing = health.failingCount || 0;
    return (
      <span
        className="page-header-health"
        data-state="failing"
        role="status"
        aria-live="polite"
        title={`Last test failed for ${failing} of ${total} delivery channels. Last run: ${new Date(health.lastRun).toLocaleString()}`}
      >
        <span className="ph-dot" aria-hidden="true" />
        <strong>{failing} of {total} channel{total === 1 ? "" : "s"} failing</strong>
        {health.lastRun && <small>· last run {formatRelativeShort(health.lastRun)}</small>}
      </span>
    );
  }
  return (
    <span
      className="page-header-health"
      data-state="unknown"
      role="status"
      aria-live="polite"
      title="Run the in-app delivery self-test to validate every channel."
    >
      <span className="ph-dot" aria-hidden="true" />
      <strong>Delivery health</strong>
      <small>· run the test below to validate</small>
    </span>
  );
}

export default function Settings() {
  const { members, addMember, updateMember, removeMember, resetToDemoData, notificationPermission, requestNotifications, sendTestNotification } = useFamily();
  const { configured, user, household, householdProfileExtra, memberProfile, updateHouseholdSettings, updateHouseholdProfile, invitePartner, updatePassword, signOut, deleteAccount } = useAuth();
  const deliveryHealth = useDeliveryHealth();
  const [editingMember, setEditingMember] = useState(null); // member object or "new"
  const [name, setName] = useState("");
  const [role, setRole] = useState("Kid");
  const [color, setColor] = useState(FAMILY_COLORS[0].id);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarStatus, setAvatarStatus] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteSmsConsent, setInviteSmsConsent] = useState(false);
  const [inviteStatus, setInviteStatus] = useState("");
  const [smsFallbackUrl, setSmsFallbackUrl] = useState("");
  const [inviting, setInviting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [inviteActionStatus, setInviteActionStatus] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [removeMemberError, setRemoveMemberError] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [notificationTestStatus, setNotificationTestStatus] = useState("");
  const [testingNotification, setTestingNotification] = useState(false);
  const [editingHousehold, setEditingHousehold] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [householdCity, setHouseholdCity] = useState("");
  const [householdRegion, setHouseholdRegion] = useState("");
  const [householdPostalCode, setHouseholdPostalCode] = useState("");
  const [householdCountry, setHouseholdCountry] = useState("");
  const [householdAddress, setHouseholdAddress] = useState("");
  const [householdLatitude, setHouseholdLatitude] = useState(null);
  const [householdLongitude, setHouseholdLongitude] = useState(null);
  const [householdDietary, setHouseholdDietary] = useState([]);
  const [householdAvoid, setHouseholdAvoid] = useState("");
  const [householdSaving, setHouseholdSaving] = useState(false);
  const [householdStatus, setHouseholdStatus] = useState("");
  const [cachedCount, setCachedCount] = useState(0);
  const [confirmingClearCache, setConfirmingClearCache] = useState(false);
  const [cacheClearStatus, setCacheClearStatus] = useState("");
  const householdLocationResolved = (
    householdLatitude !== null
    && householdLatitude !== ""
    && householdLongitude !== null
    && householdLongitude !== ""
    && Number.isFinite(Number(householdLatitude))
    && Number.isFinite(Number(householdLongitude))
  );

  const openHouseholdEditor = () => {
    setHouseholdName(household?.name || "");
    setHouseholdCity(householdProfileExtra?.city || "");
    setHouseholdRegion(householdProfileExtra?.region || "");
    setHouseholdPostalCode(householdProfileExtra?.postalCode || "");
    setHouseholdCountry(householdProfileExtra?.country || "");
    setHouseholdAddress(householdProfileExtra?.address || "");
    setHouseholdLatitude(householdProfileExtra?.latitude ?? null);
    setHouseholdLongitude(householdProfileExtra?.longitude ?? null);
    setHouseholdDietary(householdProfileExtra?.dietaryRestrictions || []);
    setHouseholdAvoid(householdProfileExtra?.avoidIngredients || "");
    setHouseholdStatus("");
    setEditingHousehold(true);
  };

  const saveHousehold = async () => {
    setHouseholdSaving(true);
    setHouseholdStatus("");
    try {
      const payload = {
        city: householdCity,
        region: householdRegion,
        postalCode: householdPostalCode,
        country: householdCountry,
        address: householdAddress,
        latitude: householdLatitude,
        longitude: householdLongitude,
        dietaryRestrictions: householdDietary,
        avoidIngredients: householdAvoid,
      };
      if (isMasterOwner) await updateHouseholdSettings({ name: householdName, ...payload });
      else await updateHouseholdProfile(payload);
      setEditingHousehold(false);
    } catch (error) {
      setHouseholdStatus(error.message || "Could not update household details.");
    } finally {
      setHouseholdSaving(false);
    }
  };

  const loadPendingInvites = async () => {
    if (!configured || !household?.id || !supabase) return;
    let { data, error } = await supabase.from("household_invitations").select("id,invited_name,email,phone,expires_at").eq("household_id", household.id).is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at");
    if (error && /invited_name|phone|schema cache|column/i.test(error.message || "")) {
      ({ data, error } = await supabase.from("household_invitations").select("id,email,expires_at").eq("household_id", household.id).is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at"));
    }
    if (error) {
      setInviteActionStatus(error.message || "Could not load pending invitations.");
      return;
    }
    setPendingInvites(data || []);
  };

  const revokeInvite = async (invite) => {
    if (!supabase) return;
    const { error } = await supabase.from("household_invitations").delete().eq("id", invite.id);
    if (error) {
      setInviteActionStatus(error.message || "Could not revoke invitation.");
      return;
    }
    setInviteActionStatus(`Revoked invitation for ${invite.email}.`);
    await loadPendingInvites();
  };

  const sendHouseholdInvite = async (event) => {
    event?.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim() || inviting) return;
    if (invitePhone.trim() && !isValidPhoneNumber(invitePhone)) {
      setInviteStatus("Enter a valid mobile number with its country code.");
      return;
    }
    if (invitePhone.trim() && !inviteSmsConsent) {
      setInviteStatus("Confirm that this person agreed to receive a one-time invitation by text.");
      return;
    }
    setInviting(true);
    setInviteStatus("");
    setSmsFallbackUrl("");
    try {
      const normalizedInvitePhone = invitePhone.trim() ? normalizePhoneE164(invitePhone) : "";
      const result = await invitePartner(inviteEmail, normalizedInvitePhone, inviteName);
      setInviteStatus(result?.message || "Invitation sent.");
      if (invitePhone.trim() && result?.sms?.requested && !result.sms.sent) {
        const normalizedPhone = normalizePhoneE164(invitePhone);
        const joinUrl = `${window.location.origin}/signin?invited=1&email=${encodeURIComponent(inviteEmail.trim().toLowerCase())}`;
        const message = `You’re invited to ${household?.name || "a family home"} on FamOS. Join your family home: ${joinUrl} Reply STOP to opt out.`;
        const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? "&" : "?";
        setSmsFallbackUrl(`sms:${normalizedPhone}${separator}body=${encodeURIComponent(message)}`);
      }
      setInviteName("");
      setInviteEmail("");
      setInvitePhone("");
      setInviteSmsConsent(false);
      await loadPendingInvites();
    } catch (error) {
      setInviteStatus(error.message || "Could not send this invitation.");
    } finally {
      setInviting(false);
    }
  };

  const resendHouseholdInvite = async (invite) => {
    if (!invite?.email || inviting) return;
    setInviting(true);
    setInviteActionStatus("");
    try {
      const result = await invitePartner(invite.email, invite.phone || "", invite.invited_name || "");
      setInviteActionStatus(result?.message || `Invitation resent to ${invite.email}.`);
    } catch (error) {
      setInviteActionStatus(error.message || `Could not resend the invitation to ${invite.email}.`);
    } finally {
      setInviting(false);
      await loadPendingInvites();
    }
  };

  useEffect(() => { loadPendingInvites(); }, [configured, household?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh the local-caches count whenever the user signs in/out or
  // returns to Settings — so the "Clear cached searches" button always
  // shows an accurate live number.
  useEffect(() => {
    setCachedCount(countFamosCacheEntries());
  }, [configured, household?.id]);

  const clearCachedData = () => {
    const removed = clearAllFamosCache();
    setCachedCount(0);
    setConfirmingClearCache(false);
    setCacheClearStatus(removed === 0
      ? "Already clear — no cached entries were stored in this browser."
      : `Cleared ${removed} cached ${removed === 1 ? "entry" : "entries"}. FamOS will fetch fresh event results on your next search.`);
  };

  const openNew = () => {
    setName("");
    setRole("Kid");
    setColor(FAMILY_COLORS[members.length % FAMILY_COLORS.length].id);
    setAvatarUrl(AVATAR_PRESETS[members.length % AVATAR_PRESETS.length]?.url || "");
    setAvatarStatus("");
    setEditingMember("new");
  };

  const openEdit = (m) => {
    setName(m.name);
    setRole(m.role);
    setColor(m.color);
    setAvatarUrl(m.avatarUrl || "");
    setAvatarStatus("");
    setEditingMember(m);
  };

  const save = async () => {
    if (!name.trim()) return;
    setSavingMember(true);
    if (editingMember === "new") {
      addMember({ name: name.trim(), role, color, initials: initialsFrom(name), avatarUrl });
    } else {
      const result = await updateMember(editingMember.id, { name: name.trim(), role, color, initials: initialsFrom(name), avatarUrl });
      if (result?.error) {
        setAvatarStatus("Saved locally, but Supabase did not accept the profile update. The avatar may reset after refresh until the profile schema/policy is updated.");
      }
    }
    setSavingMember(false);
    setEditingMember(null);
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarStatus("");
    try {
      setAvatarUrl(await resizeAvatarImage(file));
      setAvatarStatus("Custom photo ready. Save to apply it.");
    } catch {
      setAvatarStatus("Could not read that image. Try another photo.");
    } finally {
      event.target.value = "";
    }
  };

  const testNotifications = async () => {
    setTestingNotification(true);
    setNotificationTestStatus("");
    try {
      const result = await sendTestNotification();
      if (result === "shown") {
        setNotificationTestStatus("Test sent. If you do not see it, check macOS/browser notification settings or Focus mode.");
      } else if (result === "denied") {
        setNotificationTestStatus("Notifications are blocked in your browser settings.");
      } else if (result === "unsupported") {
        setNotificationTestStatus("This browser or device does not support web notifications.");
      } else {
        setNotificationTestStatus("Notifications still need permission before we can send a test.");
      }
    } catch (error) {
      setNotificationTestStatus(error.message || "Could not send a test notification.");
    } finally {
      setTestingNotification(false);
    }
  };

  const openNotificationSettings = () => {
    const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isAppleMobile) {
      window.location.href = "app-settings:";
      setNotificationTestStatus("In Settings, open Apps → FamOS (or Safari) → Notifications and turn Allow Notifications on.");
      return;
    }
    setNotificationTestStatus("Open this site’s permissions from the icon beside the address bar, allow Notifications, then reload FamOS.");
  };
  const includedMembers = PRICING_PLAN.basePlan.membersIncluded;
  const isMasterOwner = household?.created_by
    ? household.created_by === user?.id
    : household?.role === "owner";
  // Owner manages the household name + everything; any parent/guardian can add
  // the shared home location & dietary preferences (children cannot).
  const canEditHome = isMasterOwner || memberProfile?.profileType !== "child";
  const extraMembers = Math.max(0, members.length - includedMembers);
  const estimatedMonthlyPlan = PRICING_PLAN.basePlan.price.monthly + extraMembers * PRICING_PLAN.basePlan.additionalMemberPrice.monthly;

  return (
    <div className="pb-24 reference-settings">
      <PageHeader eyebrow="Household" title="Settings" illustration="settings" subtitle="Tweak the home base without making it a whole thing." liveHealth={<DeliveryHealthBadge health={deliveryHealth} />} />

      <div className="px-5 space-y-6 mt-2">
        <section>
          <div className="flex items-end justify-between mb-3">
            <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)]">Home space</h2>
          </div>
          <Card className="settings-household-card">
            <div className="settings-household-icon">⌂</div>
            <div className="settings-household-summary">
              <p>Household name</p>
              <h3>{household?.name || "Home"}</h3>
              <span>{isMasterOwner ? "Master owner" : "Household member"} · Your role: {memberProfile?.profileType === "child" ? "Child" : "Parent / guardian"}</span>
              <div className="settings-household-details">
                <span><MapPin size={14} /> {[householdProfileExtra?.city, householdProfileExtra?.country].filter(Boolean).join(", ") || "Location not added"}</span>
                <span><Utensils size={14} /> Household dietary preferences</span>
              </div>
              <div className="settings-dietary-pills">
                {(householdProfileExtra?.dietaryRestrictions || []).length
                  ? householdProfileExtra.dietaryRestrictions.map((restriction) => <span key={restriction}>{restriction}</span>)
                  : <em>No dietary restrictions added</em>}
              </div>
              {householdProfileExtra?.avoidIngredients && <small>Avoid: {householdProfileExtra.avoidIngredients}</small>}
            </div>
            {canEditHome && <button className="settings-household-edit" onClick={openHouseholdEditor}><Pencil size={14} /> Edit</button>}
          </Card>
        </section>

        <section>
          <div className="flex items-end justify-between mb-3">
            <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)]">Family members</h2>
            <button onClick={openNew} className={`flex items-center gap-1 text-[13px] font-medium text-[var(--color-accent)] ${configured ? "hidden" : ""}`}>
              <Plus size={15} /> Add
            </button>
          </div>
          <Card className="family-roster-card">
            <ul className="family-roster">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--color-border)] last:border-0"
                >
                  <button disabled={configured && m.id !== user?.id} onClick={() => openEdit(m)} className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-default">
                    <Avatar member={m} size="lg" />
                    <div className="min-w-0">
                      <p className="font-medium text-[14.5px] text-[var(--color-ink)] truncate">{m.name}</p>
                      {m.email && <p className="text-[11.5px] text-[var(--color-ink-faint)] truncate">{m.email}</p>}
                      <p className="text-[12.5px] text-[var(--color-ink-soft)]">{m.role}{m.id === user?.id ? " · You" : ""}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setMemberToRemove(m); setRemoveMemberError(""); }}
                    className={`p-2 text-[var(--color-ink-faint)] ${configured && (!isMasterOwner || m.id === user?.id) ? "hidden" : ""}`}
                    aria-label={`Remove ${m.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
              {pendingInvites.map((invite) => (
                <li key={invite.id} className="family-roster-pending">
                  <div className="family-invite-avatar">{(invite.invited_name || invite.email).slice(0, 1).toUpperCase()}</div>
                  <div className="family-invite-details min-w-0 flex-1">
                    <p>{invite.invited_name || invite.email}</p>
                    <div className="family-invite-meta">
                      {invite.invited_name && <span>{invite.email}</span>}
                      {invite.phone && <span>{invite.phone}</span>}
                    </div>
                    <span className="family-invite-status">Still waiting for them to join</span>
                  </div>
                  <div className="pending-invite-actions">
                    <span className="pending-pill">Pending</span>
                    <button disabled={inviting} onClick={() => resendHouseholdInvite(invite)}><RefreshCw size={12} /> {inviting ? "Sending…" : "Resend"}</button>
                    <button className="danger" onClick={() => revokeInvite(invite)}><Trash2 size={12} /> Revoke</button>
                  </div>
                </li>
              ))}
              {members.length === 0 && (
                <li className="px-3 py-6 text-center text-[13.5px] text-[var(--color-ink-soft)]">
                  No family members yet — invite your first person above.
                </li>
              )}
            </ul>
          </Card>
          {inviteActionStatus && <p className="text-[12px] text-[var(--color-ink-soft)] mt-2 px-1">{inviteActionStatus}</p>}
          {configured && (
            <Card className="p-4 mt-3">
              <form onSubmit={sendHouseholdInvite}>
                <div className="settings-invite-fields">
                  <TextField type="text" label="Family member’s name" placeholder="e.g. Sam Lee" value={inviteName} onChange={(e) => setInviteName(e.target.value)} autoComplete="name" />
                  <TextField type="email" label="Email address" placeholder="family@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} autoComplete="email" />
                </div>
                <div className="invite-phone-field">
                  <TextField type="tel" label="Mobile number (optional)" placeholder="+1 (416) 555-0123" value={invitePhone} onChange={(e) => setInvitePhone(formatPhoneInput(e.target.value))} autoComplete="tel" inputMode="tel" aria-invalid={Boolean(invitePhone && !isValidPhoneNumber(invitePhone))} />
                  {invitePhone && !isValidPhoneNumber(invitePhone) && <small>Enter 10 digits, or include + and the country code.</small>}
                </div>
                {invitePhone.trim() && (
                  <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-3 text-[12.5px] leading-relaxed text-[var(--color-ink-soft)]">
                    <input
                      type="checkbox"
                      checked={inviteSmsConsent}
                      onChange={(event) => setInviteSmsConsent(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
                    />
                    <span>I confirm this person agreed to receive a one-time FamOS invitation by text. Standard message rates may apply.</span>
                  </label>
                )}
                <PrimaryButton type="submit" disabled={inviting || !inviteName.trim() || !inviteEmail.trim() || (Boolean(invitePhone.trim()) && !inviteSmsConsent)}>{inviting ? "Sending invitation…" : "Send invite"}</PrimaryButton>
              </form>
              {inviteStatus && <p className="text-[12px] text-[var(--color-ink-soft)] mt-2">{inviteStatus}</p>}
              {smsFallbackUrl && <a className="m3-button m3-button-outlined w-full mt-2" href={smsFallbackUrl}>Send with Messages instead</a>}
            </Card>
          )}
        </section>

        <section>
          <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)] mb-3">Plan & billing</h2>
          <Card className="p-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0">
                <Users size={18} color="var(--color-accent)" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[14.5px] text-[var(--color-ink)]">FamOS Core plan</p>
                <p className="text-[12.5px] text-[var(--color-ink-soft)] mt-0.5">
                  {formatMoney(PRICING_PLAN.basePlan.price.monthly)}/month or {formatMoney(PRICING_PLAN.basePlan.price.yearly)}/year · {includedMembers} members included
                </p>
              </div>
              <div className="text-right">
                <p className="font-[var(--font-display)] text-[22px] font-bold text-[var(--color-ink)]">{formatMoney(estimatedMonthlyPlan)}</p>
                <p className="text-[11px] text-[var(--color-ink-faint)]">est. / month</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 text-[12.5px] text-[var(--color-ink-soft)]">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-surface-sunken)] px-3 py-2">
                <span>Current household members</span>
                <strong className="text-[var(--color-ink)]">{members.length}</strong>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-surface-sunken)] px-3 py-2">
                <span>Additional members</span>
                <strong className="text-[var(--color-ink)]">{extraMembers} × {formatMoney(PRICING_PLAN.basePlan.additionalMemberPrice.monthly)}/mo</strong>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-surface-sunken)] px-3 py-2">
                <span className="inline-flex items-center gap-1.5"><Sparkles size={14} /> Smart Family Bundle</span>
                <strong className="text-[var(--color-ink)]">{formatMoney(9.99)}/mo</strong>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-surface-sunken)] px-3 py-2">
                <span className="inline-flex items-center gap-1.5"><Bot size={14} /> Fam AI</span>
                <strong className="text-[var(--color-ink)]">{formatMoney(5.99)}/mo · 100 queries</strong>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-[var(--color-good-soft)] px-3 py-2 text-[var(--color-good)]">
                <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                <span>{PRICING_PLAN.trial.days}-day trial includes everything — Core, Smart Family Bundle, and Fam AI. Card required.</span>
              </div>
            </div>
            <SecondaryButton onClick={() => { window.location.hash = "pricing"; }} className="mt-3">View pricing page</SecondaryButton>
          </Card>
        </section>

        <section>
          <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)] mb-3">Integrations</h2>
          <GoogleCalendarCard />
          <CalendarFeedsCard />
          <DeliveryTestCard />
        </section>

        <section>
          <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)] mb-3">Notifications</h2>
          <Card className="p-4">
            <div className="flex items-start gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0"><Bell size={18} color="var(--color-accent)" /></div><div><p className="font-medium text-[14.5px]">Household notifications</p><p className="text-[12.5px] text-[var(--color-ink-soft)] mt-0.5">Get notified about assigned tasks and meals, chat messages, shopping list updates, and family calendar updates on every enabled device.</p></div></div>
            <PrimaryButton onClick={requestNotifications} disabled={notificationPermission === "granted" || notificationPermission === "unsupported"}>{notificationPermission === "granted" ? "Browser notifications allowed" : notificationPermission === "denied" ? "Blocked in browser settings" : notificationPermission === "unsupported" ? "Not supported on this device" : "Enable browser notifications"}</PrimaryButton>
            {notificationPermission === "denied" && <SecondaryButton className="mt-2" onClick={openNotificationSettings}><ExternalLink size={15} /> Open notification settings</SecondaryButton>}
            {notificationPermission === "granted" && <SecondaryButton className="mt-2" onClick={testNotifications} disabled={testingNotification}>{testingNotification ? "Sending test…" : "Send a test notification"}</SecondaryButton>}
            {notificationTestStatus && <div className="notification-test-status"><CheckCircle2 size={14} /><p>{notificationTestStatus}</p></div>}
            <div className="notification-help">On iPhone and iPad, install FamOS to the Home Screen first, open the installed app, then enable notifications. Apple only permits background Web Push for Home Screen web apps.</div>
            {notificationPermission === "denied" && <p className="text-[11.5px] text-[var(--color-warn)] mt-2">Allow notifications for this site in your browser or device settings, then reload FamOS.</p>}
          </Card>
        </section>

        <section>
          <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)] mb-3">Data</h2>
          <Card className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <Info size={17} className="mt-0.5 shrink-0" color="var(--color-ink-faint)" />
              <p className="text-[13px] text-[var(--color-ink-soft)] leading-relaxed">
                {configured
                  ? "Your household data is encrypted in transit and at rest. Only members of your household can read or change it — access is gated by row-level database policies."
                  : "FamOS is in local demo mode on this device. Sign in to encrypt and sync your family\u2019s data across every device your household uses."}
              </p>
            </div>
            {!configured && <SecondaryButton onClick={() => setConfirmingReset(true)} className="flex items-center justify-center gap-2">
              <RotateCcw size={15} /> Reset to demo data
            </SecondaryButton>}
            {configured && <SecondaryButton onClick={signOut}>Sign out</SecondaryButton>}
          </Card>
        </section>

        <section>
          <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)] mb-3">Privacy</h2>
          <Card className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <ShieldCheck size={17} className="mt-0.5 shrink-0" color="var(--color-ink-faint)" />
              <p className="text-[13px] text-[var(--color-ink-soft)] leading-relaxed">
                FamOS keeps a few small shortcuts in this browser's localStorage so it can skip a network round-trip on repeat searches. None of that data leaves your device unless you sign in. You can wipe it in one tap below.
              </p>
            </div>
            <div className="cached-search-row">
              <div className="min-w-0">
                <strong>Cached searches</strong>
                <span>{cachedCount === 0
                  ? "No cached entries"
                  : `${cachedCount} ${cachedCount === 1 ? "entry" : "entries"} stored · each expires automatically after 4 hours`}</span>
              </div>
              <SecondaryButton onClick={() => setConfirmingClearCache(true)} disabled={cachedCount === 0} className="flex items-center gap-2 shrink-0">
                <Trash2 size={14} /> Clear cached searches
              </SecondaryButton>
            </div>
            {cacheClearStatus && <p className="text-[12px] text-[var(--color-ink-soft)] mt-2 px-1">{cacheClearStatus}</p>}
          </Card>
        </section>

        {configured && <section>
          <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)] mb-3">Account password</h2>
          <Card className="p-4">
            <TextField type={showNewPassword ? "text" : "password"} label="New password" placeholder="At least 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} autoComplete="new-password" />
            <button type="button" onClick={() => setShowNewPassword((value) => !value)} className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-soft)] -mt-1 mb-3">{showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />} {showNewPassword ? "Hide password" : "Show password"}</button>
            <PrimaryButton disabled={newPassword.length < 6} onClick={async () => { try { await updatePassword(newPassword); setNewPassword(""); setPasswordStatus("Password saved. You can now use it to sign in on your phone."); } catch (e) { setPasswordStatus(e.message); } }}>Save password</PrimaryButton>
            {passwordStatus && <p className="text-[12px] text-[var(--color-ink-soft)] mt-2">{passwordStatus}</p>}
          </Card>
        </section>}

        {configured && <section>
          <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-warn)] mb-3">Danger zone</h2>
          <Card className="p-4 border-[var(--color-warn)]/30">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-warn-soft)] flex items-center justify-center shrink-0"><AlertCircle size={18} color="var(--color-warn)" /></div>
              <div><p className="font-medium text-[14.5px]">{isMasterOwner ? "Delete household and my account" : "Leave household and delete my account"}</p><p className="text-[12.5px] text-[var(--color-ink-soft)] mt-0.5">{isMasterOwner ? "Only the master owner can permanently delete this home and all of its shared data." : "Remove your membership and login. You cannot delete the shared household."}</p></div>
            </div>
            <button onClick={() => { setDeleteConfirmation(""); setDeleteError(""); setConfirmingDelete(true); }} className="w-full rounded-xl border border-[var(--color-warn)] text-[var(--color-warn)] font-semibold text-[14px] py-3 active:scale-[0.98] transition-transform">Delete account</button>
          </Card>
        </section>}

        <section>
          <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)] mb-3">About</h2>
          <Card className="p-4 flex items-start gap-3">
            <img src="/brand/famos-icon.png" alt="FamOS" className="w-10 h-10 rounded-xl object-cover notion-shadow shrink-0" />
            <div>
              <p className="font-medium text-[14.5px] text-[var(--color-ink)]">FamOS</p>
              <p className="text-[12.5px] text-[var(--color-ink-soft)]">Version 1.0 · Private {configured ? "& synced" : "& local"}</p>
              <p className="text-[12px] text-[var(--color-ink-soft)] mt-2 leading-relaxed">
                Developed by the team at{" "}
                <a href="https://getastronaut.io" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)]">
                  Astronaut Digital <ExternalLink size={10} />
                </a>
                <br />Part of Astronaut Ventures
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button onClick={() => { window.location.hash = "privacy"; }} className="text-[12px] font-semibold text-[var(--color-accent)]">Privacy policy</button>
                <button onClick={() => { window.location.hash = "terms"; }} className="text-[12px] font-semibold text-[var(--color-accent)]">Terms of service</button>
              </div>
            </div>
          </Card>
        </section>
      </div>

      {/* Member editor */}
      <Modal open={!!editingMember} onClose={() => setEditingMember(null)} title={editingMember === "new" ? "Add family member" : "Edit family member"}>
        <TextField label="Name" placeholder="e.g. Priya" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-2">Avatar</p>
        <div className="avatar-editor">
          <div className="avatar-editor-preview" style={{ backgroundColor: avatarUrl ? "#fff" : FAMILY_COLORS.find((item) => item.id === color)?.value || "var(--color-accent)" }}>
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initialsFrom(name || "Family")}</span>}
          </div>
          <div className="avatar-editor-actions">
            <label>
              <input type="file" accept="image/*" onChange={uploadAvatar} />
              <ImagePlus size={15} /> Upload photo
            </label>
            <button type="button" onClick={() => { setAvatarUrl(""); setAvatarStatus("Initials selected. Save to apply it."); }}>Use initials</button>
          </div>
        </div>
        <div className="avatar-preset-grid">
          {AVATAR_PRESETS.map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              className={avatarUrl === avatar.url ? "selected" : ""}
              onClick={() => { setAvatarUrl(avatar.url); setAvatarStatus("Illustrated avatar selected. Save to apply it."); }}
              aria-label={`Use ${avatar.label} avatar`}
            >
              <img src={avatar.url} alt="" />
            </button>
          ))}
        </div>
        {avatarStatus && <p className="avatar-status">{avatarStatus}</p>}

        <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-2">Role</p>
        <div className="flex gap-2 mb-4">
          {["Parent", "Kid", "Other"].map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className="flex-1 rounded-xl px-3 py-2 text-[13.5px] font-medium border transition-colors"
              style={{
                borderColor: role === r ? "var(--color-accent)" : "var(--color-border)",
                backgroundColor: role === r ? "var(--color-accent-soft)" : "transparent",
                color: role === r ? "var(--color-accent-strong)" : "var(--color-ink-soft)",
              }}
            >
              {r}
            </button>
          ))}
        </div>

        <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-2">Color</p>
        <div className="flex flex-wrap gap-3 mb-5">
          {FAMILY_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => setColor(c.id)}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: c.value, outline: color === c.id ? `2.5px solid ${c.value}` : "none", outlineOffset: 2 }}
              aria-label={c.label}
            >
              {color === c.id && (
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6.2L4.7 9L10 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {editingMember && editingMember !== "new" && !configured && (
            <SecondaryButton
              onClick={() => {
                setMemberToRemove(editingMember);
                setRemoveMemberError("");
                setEditingMember(null);
              }}
            >
              Remove
            </SecondaryButton>
          )}
          <PrimaryButton onClick={save} disabled={!name.trim() || savingMember}>
            {savingMember ? "Saving…" : "Save"}
          </PrimaryButton>
        </div>
      </Modal>

      <ConfirmAction
        open={!!memberToRemove}
        busy={removingMember}
        onClose={() => { if (!removingMember) { setMemberToRemove(null); setRemoveMemberError(""); } }}
        onConfirm={async () => {
          setRemovingMember(true);
          setRemoveMemberError("");
          try {
            await removeMember(memberToRemove.id);
            setMemberToRemove(null);
          } catch (error) {
            setRemoveMemberError(error.message || "Could not remove this family member.");
          } finally {
            setRemovingMember(false);
          }
        }}
        title={`Remove ${memberToRemove?.name || "family member"}?`}
        copy={
          removeMemberError
            ? removeMemberError
            : `They will immediately lose access to ${household?.name || "this household"} and its calendar, tasks, meals, shopping list and chat. Their FamOS login will not be deleted. You can invite them back later.`
        }
        confirmLabel={removingMember ? "Removing…" : "Remove member"}
        tier="type-to-confirm"
        word="REMOVE"
        busyLabel="Removing…"
      />

      <ConfirmAction
        open={confirmingReset}
        onClose={() => setConfirmingReset(false)}
        onConfirm={() => {
          resetToDemoData();
          setConfirmingReset(false);
        }}
        title="Reset to demo data?"
        copy="This replaces your current family members, calendar, meals, shopping list, and tasks with the original demo data. This can't be undone — every action the family has taken will be erased."
        confirmLabel="Reset to demo data"
        tier="type-to-confirm"
        word="RESET"
      />

      <Modal open={editingHousehold} onClose={() => setEditingHousehold(false)} title={isMasterOwner ? "Edit household" : "Home location & preferences"}>
        {isMasterOwner
          ? <TextField label="Household name" value={householdName} onChange={(event) => setHouseholdName(event.target.value)} placeholder="e.g. The Miller Family" />
          : <p className="settings-household-note">Adding the shared home address and dietary preferences for <strong>{household?.name}</strong>. Only the master owner can rename the household.</p>}
        <AddressAutocomplete
          value={householdAddress}
          onChange={(place) => {
            setHouseholdAddress(place.address ?? householdAddress);
            if (place.city !== undefined) setHouseholdCity(place.city);
            if (place.region !== undefined) setHouseholdRegion(place.region);
            if (place.postalCode !== undefined) setHouseholdPostalCode(place.postalCode);
            if (place.country !== undefined) setHouseholdCountry(place.country);
            if (place.latitude !== undefined) setHouseholdLatitude(place.latitude);
            if (place.longitude !== undefined) setHouseholdLongitude(place.longitude);
          }}
        />
        <div className="onboarding-address-preview settings-address-preview" aria-live="polite">
          {[
            ["Address", householdAddress],
            ["City", householdCity],
            ["Province / state", householdRegion],
            ["Postal code", householdPostalCode],
            ["Country", householdCountry],
          ].map(([label, value]) => (
            <div key={label} className={label === "Address" ? "wide" : ""}>
              <span>{label}</span>
              <strong>{value || "Filled automatically"}</strong>
            </div>
          ))}
        </div>
        <p className="text-[11.5px] leading-relaxed text-[var(--color-ink-faint)] -mt-1 mb-3">Google Maps fills these details automatically. Your address powers local weather and location-aware household features.</p>
        <p className="settings-field-label">Household dietary preferences</p>
        <div className="settings-dietary-picker">
          {HOUSEHOLD_DIETARY_OPTIONS.map((restriction) => (
            <button
              type="button"
              key={restriction}
              className={householdDietary.includes(restriction) ? "selected" : ""}
              onClick={() => setHouseholdDietary((current) => current.includes(restriction) ? current.filter((item) => item !== restriction) : [...current, restriction])}
            >
              {restriction}
            </button>
          ))}
        </div>
        <TextField label="Ingredients to avoid" value={householdAvoid} onChange={(event) => setHouseholdAvoid(event.target.value)} placeholder="e.g. peanuts, cilantro" />
        {householdStatus && <p className="settings-save-status">{householdStatus}</p>}
        <div className="flex gap-2">
          <SecondaryButton onClick={() => setEditingHousehold(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={saveHousehold} disabled={householdSaving || !householdName.trim() || (Boolean(householdAddress.trim()) && !householdLocationResolved)}>{householdSaving ? "Saving…" : "Save household"}</PrimaryButton>
        </div>
      </Modal>

      <Modal open={confirmingClearCache} onClose={() => setConfirmingClearCache(false)} title="Clear cached searches?">
        <p className="text-[14px] text-[var(--color-ink-soft)] mb-2">
          This removes <strong>{cachedCount}</strong> cached {cachedCount === 1 ? "entry" : "entries"} from this browser.
          FamOS will fetch fresh event results on your next search.
        </p>
        <p className="text-[12px] text-[var(--color-ink-faint)] mb-5">
          Your household data, accounts, and anything stored on FamOS servers is untouched — only the local shortcuts kept in this browser go.
        </p>
        <div className="flex gap-2">
          <SecondaryButton onClick={() => setConfirmingClearCache(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={clearCachedData} disabled={cachedCount === 0}>
            Clear {cachedCount} {cachedCount === 1 ? "entry" : "entries"}
          </PrimaryButton>
        </div>
      </Modal>

      <Modal open={confirmingDelete} onClose={() => { if (!deleting) setConfirmingDelete(false); }} title={isMasterOwner ? "Permanently delete this household?" : "Leave this household?"}>
        <div className="w-11 h-11 rounded-xl bg-[var(--color-warn-soft)] flex items-center justify-center mb-4"><Trash2 size={19} color="var(--color-warn)" /></div>
        <p className="text-[13.5px] text-[var(--color-ink-soft)] leading-relaxed mb-4">{isMasterOwner ? "As the master owner, this permanently deletes the entire household—including tasks, expenses, meals, shopping list, calendar events, chat, and memberships. Other members keep their personal FamOS logins." : "Your login and membership will be removed. The household and its shared data remain under the master owner."}</p>
        <TextField label="Type DELETE to confirm" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" />
        {deleteError && <p className="text-[12.5px] text-[var(--color-warn)] mb-3">{deleteError}</p>}
        <div className="flex gap-2">
          <SecondaryButton disabled={deleting} onClick={() => setConfirmingDelete(false)}>Cancel</SecondaryButton>
          <button disabled={deleting || deleteConfirmation !== "DELETE"} onClick={async () => { setDeleting(true); setDeleteError(""); try { await deleteAccount(); } catch (error) { setDeleteError(error.message || "Could not delete account."); setDeleting(false); } }} className="w-full rounded-xl bg-[var(--color-warn)] text-white font-semibold text-[14px] py-3 disabled:opacity-40 active:scale-[0.98] transition-transform">{deleting ? "Deleting…" : "Delete forever"}</button>
        </div>
      </Modal>
    </div>
  );
}
