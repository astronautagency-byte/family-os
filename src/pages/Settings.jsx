import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bell, Bug, CalendarDays, Check, CheckCircle2, ChevronRight, Clipboard, Eye, EyeOff, ExternalLink, ImagePlus, Info, Lightbulb, Link2, Mail, MapPin, Megaphone, Palette, Pencil, Phone, Plus, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Ticket, Trash2, Upload, Users, Utensils } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { useAuth } from "../context/AuthContext";
import { Alert, Avatar, Card, MenuDropdown, Modal, PrimaryButton, SecondaryButton, TextAreaField, TextField } from "../components/ui";
import ConfirmAction from "../components/ConfirmAction";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";
import PageHeader from "../components/PageHeader";
import PullToRefresh from "../components/PullToRefresh";
import { passwordError } from "../utils/passwordStrength";
import { FAMILY_COLORS } from "../data/mockData";
import { AVATAR_PRESETS } from "../data/avatarLibrary";
import { PRICING_PLAN, formatMoney } from "../data/pricingPlan";
import { PREMIUM_FEATURES, PLAN_FEATURES } from "../data/billingCatalog";
import { supabase } from "../lib/supabase";
import AddressAutocomplete from "../components/AddressAutocomplete";
import { formatPhoneInput, isValidPhoneNumber, normalizePhoneE164 } from "../utils/phone";
import { parseTaskImportText } from "../utils/appleTaskImport";
import { APP_COLOR_SCHEMES } from "../data/appColorSchemes";

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
    googleConnected, googleStatus, googleError, googleLastSynced, googleEvents, googleCalendars, selectedGoogleCalendarIds, sharedGoogleCalendarIds, calendarFeeds,
    googleUsesAccount,
    connectGoogleCalendar, reconnectGoogleCalendar, syncGoogleCalendarNow, disconnectGoogleCalendar, toggleGoogleCalendar, toggleGoogleCalendarSharing, renameGoogleCalendar,
  } = useFamily();
  const [showSetup, setShowSetup] = useState(!googleClientId);
  const [renamingCalendarId, setRenamingCalendarId] = useState(null);
  const [calendarNameDraft, setCalendarNameDraft] = useState("");
  const [calendarNameError, setCalendarNameError] = useState("");
  const isBusy = googleStatus === "connecting" || googleStatus === "syncing";
  const connectedCount = selectedGoogleCalendarIds.length + calendarFeeds.length;

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
          <div><strong>Connected calendars</strong><span>{connectedCount} of 5 used</span></div>
          <p className="google-calendar-help">Choose up to five calendars and decide whether each stays private or appears for your household.</p>
          <ul>
            {googleCalendars.map((calendar) => {
              const connected = selectedGoogleCalendarIds.includes(calendar.id);
              const shared = sharedGoogleCalendarIds.includes(calendar.id);
              const displayName = calendar.displayName || calendar.summary;
              return (
                <li key={calendar.id} className={connected ? "is-connected" : ""}>
                  <button className="google-calendar-main" onClick={() => toggleGoogleCalendar(calendar.id)} disabled={isBusy || (!connected && connectedCount >= 5)} aria-pressed={connected}>
                    <i style={{ backgroundColor: calendar.backgroundColor }} />
                    <span>
                      <b>{displayName}</b>
                      <small>{calendar.primary ? "Primary calendar" : calendar.accessRole === "reader" ? "Read only" : "Can add events"}</small>
                    </span>
                    <em>{connected ? <CheckCircle2 /> : "Connect"}</em>
                  </button>
                  <button
                    className="google-calendar-rename"
                    type="button"
                    onClick={() => { setRenamingCalendarId(calendar.id); setCalendarNameDraft(displayName); setCalendarNameError(""); }}
                    disabled={isBusy}
                    aria-label={`Rename ${displayName}`}
                    title="Give this calendar a name in FamOS"
                  ><Pencil size={14} /><span>Name</span></button>
                  <button
                    className={`google-calendar-visibility ${shared ? "is-shared" : ""}`}
                    onClick={() => toggleGoogleCalendarSharing(calendar.id)}
                    disabled={isBusy || !connected}
                    aria-pressed={shared}
                    title={connected ? "Change household visibility" : "Connect this calendar first"}
                  >
                    {shared ? <Users size={15} /> : <EyeOff size={15} />}
                    <span>{shared ? "Shared" : "Private"}</span>
                  </button>
                  {renamingCalendarId === calendar.id && (
                    <form className="google-calendar-rename-form" onSubmit={async (event) => {
                      event.preventDefault();
                      try {
                        await renameGoogleCalendar(calendar.id, calendarNameDraft);
                        setRenamingCalendarId(null);
                        setCalendarNameError("");
                      } catch (error) {
                        setCalendarNameError(error?.message || "That calendar name could not be saved.");
                      }
                    }}>
                      <label htmlFor={`calendar-name-${calendar.id}`}>Name shown in FamOS</label>
                      <div><input id={`calendar-name-${calendar.id}`} autoFocus maxLength={80} value={calendarNameDraft} onChange={(event) => setCalendarNameDraft(event.target.value)} placeholder={calendar.summary} /><button type="submit">Save</button><button type="button" onClick={() => setRenamingCalendarId(null)}>Cancel</button></div>
                      {calendarNameError && <small role="alert">{calendarNameError}</small>}
                    </form>
                  )}
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
        <div className="grid gap-2 sm:grid-cols-2">
          <SecondaryButton onClick={disconnectGoogleCalendar} disabled={isBusy}>
            Disconnect
          </SecondaryButton>
          <PrimaryButton onClick={googleStatus === "expired" ? reconnectGoogleCalendar : syncGoogleCalendarNow} disabled={isBusy}>
            {googleStatus === "syncing" ? "Syncing…" : googleStatus === "expired" ? "Reconnect Google" : googleStatus === "error" ? "Try sync again" : "Sync now"}
          </PrimaryButton>
          <SecondaryButton
            className="sm:col-span-2 flex items-center justify-center gap-2"
            onClick={() => window.dispatchEvent(new CustomEvent("famos:add-calendar-feed", { detail: { provider: "google" } }))}
            disabled={isBusy}
          >
            <Plus size={15} /> Add another Google account
          </SecondaryButton>
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
    addCalendarFeed, importCalendarFile, syncCalendarFeed, removeCalendarFeed, toggleCalendarFeedSharing,
    selectedGoogleCalendarIds,
  } = useFamily();
  const [adding, setAdding] = useState(false);
  const [provider, setProvider] = useState("apple");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const busy = calendarFeedStatus === "syncing";
  const connectedCount = selectedGoogleCalendarIds.length + calendarFeeds.length;
  const atLimit = connectedCount >= 5;
  const providerLabel = provider === "google" ? "Google account" : provider === "apple" ? "Apple / iCloud" : provider === "outlook" ? "Outlook / Microsoft 365" : provider === "school" ? "your school" : provider === "sports" ? "your team or league" : "Calendar";

  useEffect(() => {
    const openForProvider = (event) => {
      setProvider(event.detail?.provider || "ical");
      setAdding(true);
      setShowAdvanced(true);
      window.setTimeout(() => document.getElementById("additional-calendar-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    };
    window.addEventListener("famos:add-calendar-feed", openForProvider);
    return () => window.removeEventListener("famos:add-calendar-feed", openForProvider);
  }, []);

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
    <Card className="p-4 mt-3" id="additional-calendar-form">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
          <Link2 size={18} color="var(--color-ink)" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[14.5px] text-[var(--color-ink)]">Additional calendars</p>
          <p className="text-[12.5px] text-[var(--color-ink-soft)]">Google, Apple, Outlook, school and sports · {connectedCount}/5 connected</p>
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
              <button className={`google-calendar-visibility ${feed.sharedWithHousehold ? "is-shared" : ""}`} onClick={() => toggleCalendarFeedSharing(feed.id)} aria-pressed={Boolean(feed.sharedWithHousehold)} title="Change household visibility">
                {feed.sharedWithHousehold ? <Users size={15} /> : <EyeOff size={15} />}
                <span>{feed.sharedWithHousehold ? "Shared" : "Private"}</span>
              </button>
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

      {atLimit && !adding && <p className="calendar-limit-note"><CheckCircle2 size={15}/>Five calendars connected. Remove one to add another.</p>}

      {adding ? (
        <div>
          <label className="block text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-1.5">Calendar type</label>
          <select value={provider} onChange={(event) => setProvider(event.target.value)} className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-[14px] mb-3">
            <option value="apple">Apple / iCloud</option>
            <option value="google">Another Google account</option>
            <option value="outlook">Outlook / Microsoft 365</option>
            <option value="school">School calendar subscription</option>
            <option value="sports">Sports / team calendar subscription</option>
            <option value="ical">Other iCal feed</option>
          </select>
          <TextField label="Calendar name (optional)" placeholder={provider === "google" ? "e.g. Alex's work Google Calendar" : "e.g. Kat's work calendar"} value={name} onChange={(event) => setName(event.target.value)} />
          {provider !== "google" && <label className="calendar-file-import"><input type="file" accept=".ics,text/calendar" onChange={importFile} disabled={fileBusy}/><Upload/><strong>{fileBusy ? "Importing…" : "Choose calendar export"}</strong><span>Select an .ics file from Apple Calendar, Outlook, or another calendar app.</span></label>}
          {provider === "google" && (
            <div className="additional-google-help">
              <div><ShieldCheck size={17} /><p><strong>Private, read-only connection</strong><span>In that Google account, open Calendar settings → select a calendar → Integrate calendar → copy the Secret address in iCal format.</span></p></div>
              <p>Anyone with this secret link can read that calendar. FamOS stores it in this browser; remove the connection here or reset the secret in Google at any time.</p>
            </div>
          )}
          {provider !== "google" && <button className="advanced-calendar-toggle" onClick={() => setShowAdvanced((value) => !value)}>{showAdvanced ? "Hide subscription link" : "Sync with a subscription link"}</button>}
          {(showAdvanced || provider === "google") && <div className="advanced-calendar-fields"><TextField label={provider === "google" ? "Secret iCal address" : "Published calendar URL"} placeholder="https://…/calendar.ics or webcal://…" value={url} onChange={(event) => setUrl(event.target.value)} inputMode="url" /><p>{provider === "google" ? "This adds a calendar from another Google account without replacing your primary Google connection." : `Paste the subscription link provided by ${providerLabel}.`}</p><PrimaryButton disabled={busy || !url.trim()} onClick={connect}>{busy ? "Connecting…" : provider === "google" ? "Add Google calendar" : "Connect synced feed"}</PrimaryButton></div>}
          <SecondaryButton disabled={busy || fileBusy} onClick={() => setAdding(false)}>Cancel</SecondaryButton>
        </div>
      ) : (
        <SecondaryButton disabled={atLimit} onClick={() => setAdding(true)} className="flex items-center justify-center gap-2"><Plus size={15} /> {atLimit ? "5 calendar limit reached" : "Add calendar or account"}</SecondaryButton>
      )}
    </Card>
  );
}

const TASK_IMPORT_SOURCES = {
  apple: { label: "Apple", name: "Imported from Apple", help: "Copy items from Notes or Reminders, or upload a TXT/CSV export." },
  google: { label: "Google Tasks", name: "Imported from Google Tasks", help: "Paste task titles or upload the TXT/CSV file you exported from Google." },
  microsoft: { label: "Microsoft To Do", name: "Imported from Microsoft To Do", help: "Paste task titles or upload a TXT/CSV export from Microsoft To Do." },
};

function TaskImportCard() {
  const { taskLists, addTask, addTaskList } = useFamily();
  const [sourceText, setSourceText] = useState("");
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [targetListId, setTargetListId] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState("apple");
  const sourceMeta = TASK_IMPORT_SOURCES[source];

  const review = () => {
    const parsed = parseTaskImportText(sourceText);
    setItems(parsed);
    setSelected(parsed.map((_, index) => index));
    setStatus(parsed.length ? "Review what will be added. Nothing imports until you confirm." : "We couldn't find any list items yet.");
  };

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setSourceText(text);
    const parsed = parseTaskImportText(text);
    setItems(parsed);
    setSelected(parsed.map((_, index) => index));
    setStatus(parsed.length ? `Found ${parsed.length} item${parsed.length === 1 ? "" : "s"}. Review them below.` : "We couldn't find any list items in that file.");
    event.target.value = "";
  };

  const importItems = async () => {
    const approved = items.filter((_, index) => selected.includes(index));
    if (!approved.length) return;
    setBusy(true);
    setStatus("");
    try {
      let listId = targetListId;
      if (!listId) listId = (await addTaskList({ name: sourceMeta.name, color: "#7F56D9" }))?.id || "";
      for (const title of approved) await addTask({ title, listId: listId || null, taskType: "home" });
      setSourceText("");
      setItems([]);
      setSelected([]);
      setTargetListId(listId);
      setStatus(`${approved.length} item${approved.length === 1 ? "" : "s"} added to Tasks.`);
    } catch (error) {
      setStatus(error?.message || "Those items could not be imported.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="apple-import-card">
      <div className="apple-import-head"><span><Clipboard size={18}/></span><div><strong>Import tasks & lists</strong><small>Bring existing tasks into FamOS without connecting your whole account.</small></div></div>
      <div className="task-import-source" role="group" aria-label="Import source">{Object.entries(TASK_IMPORT_SOURCES).map(([id, meta]) => <button type="button" key={id} className={source === id ? "is-selected" : ""} aria-pressed={source === id} onClick={() => setSource(id)}>{meta.label}</button>)}</div>
      <ol className="apple-import-steps"><li>{sourceMeta.help}</li><li>Choose the destination list and review every item.</li><li>Confirm the import—FamOS never adds items automatically.</li></ol>
      <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder={'Paste a list here…\nPick up prescriptions\nBook the dentist\nReturn library books'} aria-label={`${sourceMeta.label} task list`} />
      <div className="apple-import-actions"><label><Upload size={15}/><span>Choose file</span><input type="file" accept=".txt,.csv,text/plain,text/csv" onChange={readFile}/></label><SecondaryButton disabled={!sourceText.trim()} onClick={review}>Review items</SecondaryButton></div>
      {items.length > 0 && <div className="apple-import-review"><div><strong>{selected.length} of {items.length} selected</strong><select value={targetListId} onChange={(event) => setTargetListId(event.target.value)} aria-label="Destination task list"><option value="">New “{sourceMeta.name}” list</option>{taskLists.map((list) => <option value={list.id} key={list.id}>{list.name}</option>)}</select></div><ul>{items.map((item, index) => <li key={`${item}-${index}`}><label><input type="checkbox" checked={selected.includes(index)} onChange={() => setSelected((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index])}/><span>{item}</span></label></li>)}</ul><PrimaryButton disabled={busy || !selected.length} onClick={importItems}>{busy ? "Importing…" : `Import ${selected.length} to Tasks`}</PrimaryButton></div>}
      {status && <p className="apple-import-status" role="status">{status}</p>}
      <p className="apple-import-privacy"><ShieldCheck size={14}/>FamOS only reads the text or file you choose. Nothing is imported before review.</p>
    </Card>
  );
}

export default function Settings({ colorScheme = "famos", onColorSchemeChange = () => {} }) {
  const { members, addMember, updateMember, removeMember, resetToDemoData, notificationPermission, requestNotifications, sendTestNotification, refreshData } = useFamily();
  const { configured, user, household, householdProfileExtra, memberProfile, updateHouseholdSettings, updateHouseholdProfile, invitePartner, updatePassword, signOut, deleteAccount } = useAuth();
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
  const [smsFallbackCopied, setSmsFallbackCopied] = useState(null);
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
  const [supportForm, setSupportForm] = useState(null); // null | "email" | "bug" | "ticket" | "feature"
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportEmail, setSupportEmail] = useState(user?.email || "");
  const [supportPriority, setSupportPriority] = useState("normal");
  const [supportSteps, setSupportSteps] = useState("");
  const [supportSending, setSupportSending] = useState(false);
  const [supportSent, setSupportSent] = useState(false);
  const [supportError, setSupportError] = useState("");
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
    setSmsFallbackCopied(null);
    try {
      const normalizedInvitePhone = invitePhone.trim() ? normalizePhoneE164(invitePhone) : "";
      const result = await invitePartner(inviteEmail, normalizedInvitePhone, inviteName);
      setInviteStatus(result?.message || "Invitation sent.");
      if (invitePhone.trim() && result?.sms?.requested && !result.sms.sent) {
        const normalizedPhone = normalizePhoneE164(invitePhone);
        const joinUrl = `${window.location.origin}/signin?invited=1&email=${encodeURIComponent(inviteEmail.trim().toLowerCase())}`;
        const message = `You’re invited to ${household?.name || "a family home"} on FamOS. Join your family home: ${joinUrl} Reply STOP to opt out.`;
        const originalPhone = invitePhone.trim();
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
          // iOS Safari silently strips the body fragment on sms: URIs
          // (and on some versions refuses the scheme outright), so the
          // "Send with Messages" link would land the user in Messages
          // with an empty compose. Fall back to the clipboard. iOS
          // Safari may not preserve user activation across the
          // `await invitePartner(...)` boundary — clipboard.writeText
          // can no-op silently — so chain a then/catch so we can show
          // a copyable textarea as a fallback.
          const setCopied = (mode) => setSmsFallbackCopied({ phone: originalPhone, message, mode });
          if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(message).then(() => setCopied("auto"), () => setCopied("manual"));
          } else {
            setCopied("manual");
          }
        } else {
          setSmsFallbackUrl(`sms:${normalizedPhone}?body=${encodeURIComponent(message)}`);
        }
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
      const result = await updateMember(editingMember.id, { name: name.trim(), role, color, initials: initialsFrom(name), avatarUrl });        if (result?.error) {
        setAvatarStatus("Saved on this device, but the cloud sync hasn't accepted the avatar update yet — it may need a quick profile schema update before it sticks.");
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
      // iOS Safari does NOT honour the `app-settings:` URL scheme. Setting
      // window.location.href to it produces "Safari cannot open the page
      // because the address is invalid". Web pages cannot deep-link into
      // Settings.app — the user has to navigate there themselves. Show a
      // copy-pasteable walkthrough (consistent with the .notification-help
      // Home-Screen-install prerequisite shown elsewhere on the page).
      setNotificationTestStatus("Install FamOS to your iPhone's Home Screen first, open the installed app, then in iOS Settings tap FamOS → Notifications → turn on Allow Notifications. Apple's web push only works for Home Screen-installed apps.");
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

  // ── Subscription status (Chargebee-backed) ──
  // Pulls the household's real subscription via get_my_subscription so the
  // Plan & billing card can show a status badge, payment method, and
  // next-charge date instead of the static PRICING_PLAN values.
  const [subscription, setSubscription] = useState(null);
  const [usageStatus, setUsageStatus] = useState(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState("");

  const planFeature = (() => {
    if (!subscription?.chargebee_items?.length) return null;
    const itemId = subscription.chargebee_items[0];
    return PLAN_FEATURES.find((plan) => itemId.includes(plan.id)) || null;
  })();

  // Auto-select the manual-mode clipboard textarea on mount so the
  // user lands with text already selected — next long-press → Copy
  // works without an intermediate tap to focus.
  const manualCopyRef = useRef(null);
  useEffect(() => {
    if (smsFallbackCopied?.mode === "manual") manualCopyRef.current?.select();
  }, [smsFallbackCopied?.mode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [subscriptionResult, usageResult] = await Promise.all([
          supabase.rpc("get_my_subscription"),
          supabase.functions.invoke("usage-status"),
        ]);
        if (!cancelled && !subscriptionResult.error && subscriptionResult.data?.[0]) setSubscription(subscriptionResult.data[0]);
        if (!cancelled && !usageResult.error && usageResult.data) setUsageStatus(usageResult.data);
      } catch {
        // * — subscription is optional; missing RPC must not break Settings.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openBillingPortal = async () => {
    setBillingError("");
    setBillingBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("chargebee-portal");
      if (error) {
        let message = data?.error || error.message;
        try { if (error.context instanceof Response) message = (await error.context.clone().json())?.error || message; } catch { /* keep client message */ }
        throw new Error(message);
      }
      const url = data?.url;
      if (!url) throw new Error("Couldn't open the billing portal. Please try again in a moment.");
      window.location.assign(url);
    } catch (err) {
      setBillingError(err?.message || "Could not open the billing portal. Please try again.");
      setBillingBusy(false);
    }
  };

  const addPaidFeature = async (feature) => {
    setBillingError("");
    setBillingBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("chargebee-checkout", { body: { feature } });
      if (error) {
        let message = data?.error || error.message;
        try { if (error.context instanceof Response) message = (await error.context.clone().json())?.error || message; } catch { /* keep client message */ }
        throw new Error(message);
      }
      if (!data?.url) throw new Error("Couldn't open secure checkout.");
      window.location.assign(data.url);
    } catch (err) {
      setBillingError(err?.message || "Could not open secure checkout.");
      setBillingBusy(false);
    }
  };

  const subStatusBadge = (() => {
    if (!subscription) return null;
    const s = subscription.status;
    if (s === "trial" || s === "trialing") {
      const days = subscription.trial_ends_at
        ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86_400_000))
        : null;
      return { tone: "good", label: days !== null ? `Trial · ${days} day${days === 1 ? "" : "s"} left` : "Trial active" };
    }
    if (s === "active") return { tone: "good", label: "Active" };
    if (s === "past_due") return { tone: "warn", label: "Payment overdue" };
    if (s === "canceled") return { tone: "muted", label: "Canceled" };
    if (s === "incomplete") return { tone: "warn", label: "Setup incomplete" };
    if (s === "paused") return { tone: "muted", label: "Paused" };
    return { tone: "muted", label: s };
  })();

  const formatNextCharge = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  };

  const nextChargeLabel = (() => {
    if (!subscription) return null;
    if (subscription.status === "trial" || subscription.status === "trialing") {
      return formatNextCharge(subscription.trial_ends_at) ? `First charge after trial · ${formatNextCharge(subscription.trial_ends_at)}` : "First charge after trial";
    }
    if (subscription.status === "active" || subscription.status === "past_due") {
      return formatNextCharge(subscription.current_period_ends_at) ? `Next charge · ${formatNextCharge(subscription.current_period_ends_at)}` : null;
    }
    return null;
  })();

  const paymentMethodLabel = (() => {
    if (!subscription?.payment_method_brand || !subscription?.payment_method_last4) return null;
    return `${subscription.payment_method_brand.toUpperCase()} •••• ${subscription.payment_method_last4}`;
  })();

  return (
    <PullToRefresh onRefresh={refreshData}><div className="pb-24 reference-settings famos-noscroll">
      <PageHeader eyebrow="Household" title="Settings" illustration="settings" subtitle="Tweak the home base without making it a whole thing." />

      <div className="px-5 space-y-6 mt-2">
        <section>
          <div className="flex items-end justify-between mb-3"><h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)]">Appearance</h2></div>
          <Card className="settings-color-scheme-card">
            <div className="settings-color-scheme-head"><span><Palette size={18}/></span><div><strong>App colour</strong><small>Pick a palette that feels like home. Every option is tuned for light and dark mode.</small></div></div>
            <MenuDropdown className="settings-color-select" label="App colour schemes" value={colorScheme} options={APP_COLOR_SCHEMES.map((scheme) => ({ ...scheme, value: scheme.id }))} onChange={onColorSchemeChange} renderValue={(scheme) => <><span className="scheme-swatches" aria-hidden="true">{scheme.colors.map((color) => <i key={color} style={{ backgroundColor: color }}/>)}</span><span className="settings-color-select-copy"><strong>{scheme.label}</strong><small>{scheme.note}</small></span></>} renderOption={(scheme, selected) => <><span className="scheme-swatches" aria-hidden="true">{scheme.colors.map((color) => <i key={color} style={{ backgroundColor: color }}/>)}</span><span><strong>{scheme.label}</strong><small>{scheme.note}</small></span>{selected && <Check size={16}/>}</>}/>
          </Card>
        </section>

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
              {smsFallbackCopied?.mode === "auto" && (
                <div className="notification-test-status" role="status">
                  <CheckCircle2 size={14} />
                  <p>Invitation text copied. Open Messages on this iPhone, paste into a new text to <strong>{smsFallbackCopied.phone}</strong>, and send.</p>
                </div>
              )}
              {smsFallbackCopied?.mode === "manual" && (
                <div className="notification-test-status" role="status">
                  <Clipboard size={14} />
                  <p>Tap and hold the message below to copy, then open Messages, paste into a new text to <strong>{smsFallbackCopied.phone}</strong>, and send.</p>
                  <textarea
                    ref={manualCopyRef}
                    readOnly
                    value={smsFallbackCopied.message}
                    rows={4}
                    className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-[13px] text-[var(--color-ink)] font-sans leading-relaxed"
                    aria-label="Invitation message"
                  />
                </div>
              )}
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
                <p className="font-medium text-[14.5px] text-[var(--color-ink)]">
                  {planFeature ? planFeature.name : "FamOS Free"}
                </p>
                <p className="text-[12.5px] text-[var(--color-ink-soft)] mt-0.5">
                  {planFeature ? planFeature.tagline : "Calendar, Tasks, Shopping, Chat and Kitchen Watch are free"}
                </p>
              </div>
              {!planFeature && (
                <div className="text-right">
                  <p className="font-[var(--font-display)] text-[22px] font-bold text-[var(--color-ink)]">$0</p>
                  <p className="text-[11px] text-[var(--color-ink-faint)]">free</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 text-[12.5px] text-[var(--color-ink-soft)]">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-surface-sunken)] px-3 py-2">
                <span>Current household members</span>
                <strong className="text-[var(--color-ink)]">{members.length}</strong>
              </div>
              {PLAN_FEATURES.filter((plan) => !planFeature || plan.id !== planFeature.id).map((plan) => (
                <button key={plan.id} type="button" className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-left" onClick={() => addPaidFeature(plan.id)} disabled={billingBusy || !isMasterOwner}>
                  <span>
                    <strong className="block text-[var(--color-ink)]">{plan.name}</strong>
                    <small className="mt-0.5 block text-[var(--color-ink-soft)]">{plan.description}</small>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold text-[var(--color-accent)]">{formatMoney(plan.price)}/mo</span>
                    <span className="block text-[11px] text-[var(--color-ink-faint)]">{formatMoney(plan.priceYearly)}/yr</span>
                  </span>
                </button>
              ))}
              {subStatusBadge && (
                <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${subStatusBadge.tone === "good" ? "bg-[var(--color-good-soft)] text-[var(--color-good)]" : subStatusBadge.tone === "warn" ? "bg-[var(--color-warn-soft,#fde7d6)] text-[var(--color-warn)]" : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-soft)]"}`}>
                  <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                  <span>{subStatusBadge.label}{nextChargeLabel ? ` · ${nextChargeLabel}` : ""}</span>
                </div>
              )}
              {paymentMethodLabel && (
                <div className="flex items-center gap-2 text-[12.5px] text-[var(--color-ink-soft)]">
                  <span className="font-bold text-[var(--color-ink)]">{paymentMethodLabel}</span>
                  {subscription?.cancel_at_period_end && <span className="text-[var(--color-warn)]">· cancels at period end</span>}
                </div>
              )}
              {!subStatusBadge && (
                <div className="flex items-start gap-2 rounded-xl bg-[var(--color-good-soft)] px-3 py-2 text-[var(--color-good)]">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                  <span>Your free tools remain available even without a paid plan.</span>
                </div>
              )}
              {usageStatus && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3" aria-label="Monthly premium usage">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <strong className="text-[var(--color-ink)]">Monthly usage</strong>
                    <span className="text-[11px] text-[var(--color-ink-faint)]">Resets {formatNextCharge(usageStatus.nextReset)}</span>
                  </div>
                  {[
                    ["FamAI questions", usageStatus.famai],
                    ["Meal, recipe & Smart Capture actions", usageStatus.premiumOperations],
                  ].map(([label, usage]) => {
                    const percent = usage?.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
                    return usage ? (
                      <div key={label} className="mb-3 last:mb-0">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span>{label}</span>
                          <strong className="text-[var(--color-ink)]">{usage.remaining} left</strong>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]" role="progressbar" aria-label={label} aria-valuenow={usage.used} aria-valuemin="0" aria-valuemax={usage.limit}>
                          <div className="h-full rounded-full bg-[var(--color-accent)] transition-[width]" style={{ width: `${percent}%` }} />
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">{usage.used} of {usage.limit} used</p>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
            <SecondaryButton onClick={openBillingPortal} disabled={billingBusy} className="mt-3">
              {billingBusy ? "Opening billing portal…" : "Manage billing"}
            </SecondaryButton>
            {billingError && <div className="text-[12px] text-[var(--color-warn)] mt-2">{billingError}</div>}
          </Card>
        </section>

        <section>
          <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)] mb-3">Integrations</h2>
          <GoogleCalendarCard />
          <CalendarFeedsCard />
          <TaskImportCard />
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
                FamOS keeps a few small shortcuts in this browser's localStorage so it can skip a network round-trip on repeat searches. None of that data leaves your device unless you sign in.
              </p>
            </div>
          </Card>
        </section>

        {configured && <section>
          <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)] mb-3">Account password</h2>
          <Card className="p-4">
            <TextField type={showNewPassword ? "text" : "password"} label="New password" placeholder="8+ characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" />
            <button type="button" onClick={() => setShowNewPassword((value) => !value)} className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-soft)] -mt-1 mb-3">{showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />} {showNewPassword ? "Hide password" : "Show password"}</button>
            <PasswordStrengthMeter value={newPassword} compact />
            <PrimaryButton disabled={!!passwordError(newPassword)} onClick={async () => { try { await updatePassword(newPassword); setNewPassword(""); setPasswordStatus("Password saved. You can now use it to sign in on your phone."); } catch (e) { setPasswordStatus(e.message); } }}>Save password</PrimaryButton>
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
          <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)] mb-3">Support</h2>
          <Card className="p-4">
            <div className="space-y-2">
              <button
                onClick={() => { setSupportSubject("FamOS support request"); setSupportMessage(""); setSupportSent(false); setSupportForm("email"); }}
                className="flex items-center gap-3 rounded-xl w-full px-3 py-3 hover:bg-[var(--color-surface-sunken)] transition-colors -mx-1 text-left"
              >
                <span className="w-10 h-10 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0">
                  <Mail size={18} color="var(--color-accent)" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[14px] text-[var(--color-ink)]">Email us</p>
                  <p className="text-[12px] text-[var(--color-ink-soft)]">Send us a message and we'll get back to you</p>
                </div>
                <ChevronRight size={16} color="var(--color-ink-faint)" />
              </button>
              <button
                onClick={() => { setSupportSubject(""); setSupportMessage(""); setSupportError(""); setSupportSent(false); setSupportForm("feature"); }}
                className="flex items-center gap-3 rounded-xl w-full px-3 py-3 hover:bg-[var(--color-surface-sunken)] transition-colors -mx-1 text-left"
              >
                <span className="w-10 h-10 rounded-xl bg-[var(--color-meals-soft)] flex items-center justify-center shrink-0">
                  <Lightbulb size={18} color="var(--color-meals-strong)" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[14px] text-[var(--color-ink)]">Suggest a feature</p>
                  <p className="text-[12px] text-[var(--color-ink-soft)]">Share an idea that could make family life easier</p>
                </div>
                <ChevronRight size={16} color="var(--color-ink-faint)" />
              </button>
              <button
                onClick={() => { setSupportSubject(""); setSupportMessage(""); setSupportSteps(""); setSupportSent(false); setSupportForm("bug"); }}
                className="flex items-center gap-3 rounded-xl w-full px-3 py-3 hover:bg-[var(--color-surface-sunken)] transition-colors -mx-1 text-left"
              >
                <span className="w-10 h-10 rounded-xl bg-[var(--color-warn-soft)] flex items-center justify-center shrink-0">
                  <Bug size={18} color="var(--color-warn)" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[14px] text-[var(--color-ink)]">Report a bug</p>
                  <p className="text-[12px] text-[var(--color-ink-soft)]">Found something off? Let us know what happened</p>
                </div>
                <ChevronRight size={16} color="var(--color-ink-faint)" />
              </button>
              <button
                onClick={() => { setSupportSubject(""); setSupportMessage(""); setSupportPriority("normal"); setSupportSent(false); setSupportForm("ticket"); }}
                className="flex items-center gap-3 rounded-xl w-full px-3 py-3 hover:bg-[var(--color-surface-sunken)] transition-colors -mx-1 text-left"
              >
                <span className="w-10 h-10 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                  <Ticket size={18} color="var(--color-fam-sky)" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[14px] text-[var(--color-ink)]">Submit a support ticket</p>
                  <p className="text-[12px] text-[var(--color-ink-soft)]">Open a ticket and our team will follow up</p>
                </div>
                <ChevronRight size={16} color="var(--color-ink-faint)" />
              </button>
            </div>
          </Card>
        </section>

        <section>
          <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)] mb-3">About</h2>
          <Card className="p-4 flex items-start gap-3">
            <img src="/brand/famos-icon.png" alt="FamOS" className="w-10 h-10 rounded-xl object-cover notion-shadow shrink-0" />
            <div>
              <p className="font-medium text-[14.5px] text-[var(--color-ink)]">FamOS</p>
              <p className="text-[12.5px] text-[var(--color-ink-soft)]">Version 1.0 · Private {configured ? "& synced" : "& local"}</p>
              <p className="text-[12px] text-[var(--color-ink-soft)] mt-2 leading-relaxed">
                Made by the FamOS team. We'd love to hear what's working and what would feel even more like home.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button onClick={() => { window.location.hash = "privacy"; }} className="text-[12px] font-semibold text-[var(--color-accent)]">Privacy policy</button>
                <button onClick={() => { window.location.hash = "terms"; }} className="text-[12px] font-semibold text-[var(--color-accent)]">Terms of service</button>
                <a href="https://getastronaut.io" target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-[var(--color-accent)] inline-flex items-center gap-1">Astronaut Digital <ExternalLink size={12}/></a>
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

      {/* ── Support: Email us ── */}
      <Modal open={supportForm === "email"} onClose={() => { if (!supportSending) setSupportForm(null); }} title="Email us">
        <div className="w-11 h-11 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center mb-4"><Mail size={19} color="var(--color-accent)" /></div>
        <TextField label="Subject" value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)} placeholder="What's this about?" />
        <div className="mb-4">
          <label className="block text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-1.5">Message</label>
          <textarea
            value={supportMessage}
            onChange={(e) => setSupportMessage(e.target.value)}
            placeholder="Tell us how we can help…"
            rows={5}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-[14px] resize-none focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        {supportSent ? (
          <div className="rounded-xl bg-[var(--color-good-soft)] px-3 py-3 mb-4 text-[13px] text-[var(--color-good)] leading-snug">
            <CheckCircle2 size={16} className="inline-block mr-1.5 -mt-0.5" />
            Message sent to the FamOS team. We'll get back to you soon.
          </div>
        ) : null}
        {!supportSent && supportSending && (
          <div className="rounded-xl bg-[var(--color-accent-soft)] px-3 py-3 mb-4 text-[13px] text-[var(--color-accent-strong)] leading-snug">
            Sending message…
          </div>
        )}
        <div className="flex gap-2">
          <SecondaryButton disabled={supportSending} onClick={() => setSupportForm(null)}>Cancel</SecondaryButton>
          <PrimaryButton
            disabled={supportSending || !supportMessage.trim()}
            onClick={async () => {
              setSupportSending(true);
              try {
                const { error } = await supabase.functions.invoke("send-support-message", {
                  body: {
                    category: "email",
                    subject: supportSubject.trim() || "FamOS support request",
                    message: supportMessage.trim(),
                    senderEmail: user?.email || "",
                    userId: user?.id || null,
                    householdId: household?.id || null,
                    householdName: household?.name || "",
                  },
                });
                if (error) throw error;
                setSupportSent(true);
              } catch (e) {
                setSupportSent(true);
              } finally {
                setSupportSending(false);
              }
            }}
          >
            {supportSending ? "Sending…" : "Send message"}
          </PrimaryButton>
        </div>
      </Modal>

      {/* ── Support: Suggest a feature ── */}
      <Modal open={supportForm === "feature"} onClose={() => { if (!supportSending) setSupportForm(null); }} title="Suggest a feature">
        <div className="w-11 h-11 rounded-xl bg-[var(--color-meals-soft)] flex items-center justify-center mb-4"><Lightbulb size={19} color="var(--color-meals-strong)" /></div>
        <p className="text-[13px] text-[var(--color-ink-soft)] leading-relaxed mb-4">Got a “wouldn’t it be nice if…” moment? Send it straight to the FamOS product team.</p>
        <TextField label="Feature idea" value={supportSubject} onChange={(event) => setSupportSubject(event.target.value)} placeholder="e.g. Shared school pickup rotation" maxLength={120} />
        <TextAreaField label="How would this help your family?" value={supportMessage} onChange={(event) => setSupportMessage(event.target.value)} placeholder="Tell us what you want to do and what feels difficult today…" rows={5} maxLength={2000} />
        {supportError && <Alert tone="error" className="mb-4">{supportError}</Alert>}
        {supportSent && <Alert tone="success" className="mb-4" title="Idea sent">Thanks—your suggestion is now in the admin product inbox.</Alert>}
        <div className="flex gap-2">
          <SecondaryButton disabled={supportSending} onClick={() => setSupportForm(null)}>{supportSent ? "Close" : "Cancel"}</SecondaryButton>
          {!supportSent && <PrimaryButton disabled={supportSending || !supportSubject.trim() || !supportMessage.trim()} onClick={async () => {
            setSupportSending(true);
            setSupportError("");
            try {
              const { error } = await supabase.functions.invoke("send-support-message", { body: {
                category: "feature",
                subject: supportSubject.trim(),
                message: supportMessage.trim(),
                senderEmail: user?.email || "",
                userId: user?.id || null,
                householdId: household?.id || null,
                householdName: household?.name || "",
              } });
              if (error) throw error;
              setSupportSent(true);
            } catch (error) {
              setSupportError(error?.message || "Could not send your suggestion. Please try again.");
            } finally {
              setSupportSending(false);
            }
          }}>{supportSending ? "Sending…" : "Send idea"}</PrimaryButton>}
        </div>
      </Modal>

      {/* ── Support: Report a bug ── */}
      <Modal open={supportForm === "bug"} onClose={() => { if (!supportSending) setSupportForm(null); }} title="Report a bug">
        <div className="w-11 h-11 rounded-xl bg-[var(--color-warn-soft)] flex items-center justify-center mb-4"><Bug size={19} color="var(--color-warn)" /></div>
        <TextField label="Summary" value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)} placeholder="Briefly describe the issue" />
        <div className="mb-4">
          <label className="block text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-1.5">What happened?</label>
          <textarea
            value={supportMessage}
            onChange={(e) => setSupportMessage(e.target.value)}
            placeholder="Describe what went wrong and what you were doing when it happened…"
            rows={4}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-[14px] resize-none focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="mb-4">
          <label className="block text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-1.5">Steps to reproduce (optional)</label>
          <textarea
            value={supportSteps}
            onChange={(e) => setSupportSteps(e.target.value)}
            placeholder="1. Go to...\n2. Click on...\n3. See error..."
            rows={3}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-[14px] resize-none focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        {supportSent ? (
          <div className="rounded-xl bg-[var(--color-good-soft)] px-3 py-3 mb-4 text-[13px] text-[var(--color-good)] leading-snug">
            <CheckCircle2 size={16} className="inline-block mr-1.5 -mt-0.5" />
            Bug report sent to the FamOS team. We'll take a look.
          </div>
        ) : null}
        {!supportSent && supportSending && (
          <div className="rounded-xl bg-[var(--color-accent-soft)] px-3 py-3 mb-4 text-[13px] text-[var(--color-accent-strong)] leading-snug">
            Sending bug report…
          </div>
        )}
        <div className="flex gap-2">
          <SecondaryButton disabled={supportSending} onClick={() => setSupportForm(null)}>Cancel</SecondaryButton>
          <PrimaryButton
            disabled={supportSending || !supportSubject.trim() || !supportMessage.trim()}
            onClick={async () => {
              setSupportSending(true);
              try {
                const { error } = await supabase.functions.invoke("send-support-message", {
                  body: {
                    category: "bug",
                    subject: supportSubject.trim(),
                    message: supportMessage.trim(),
                    steps: supportSteps.trim(),
                    senderEmail: user?.email || "",
                    userId: user?.id || null,
                    householdId: household?.id || null,
                    householdName: household?.name || "",
                  },
                });
                if (error) throw error;
                setSupportSent(true);
              } catch (e) {
                setSupportSent(true);
              } finally {
                setSupportSending(false);
              }
            }}
          >
            {supportSending ? "Sending…" : "Send bug report"}
          </PrimaryButton>
        </div>
      </Modal>

      {/* ── Support: Submit a ticket ── */}
      <Modal open={supportForm === "ticket"} onClose={() => { if (!supportSending) setSupportForm(null); }} title="Submit a support ticket">
        <div className="w-11 h-11 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)] flex items-center justify-center mb-4"><Ticket size={19} color="var(--color-fam-sky)" /></div>
        <TextField label="Subject" value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)} placeholder="What do you need help with?" />
        <TextField label="Your email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="you@example.com" type="email" />
        <div className="mb-4">
          <label className="block text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-1.5">Priority</label>
          <div className="flex gap-2">
            {["low", "normal", "high"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSupportPriority(p)}
                className="flex-1 rounded-xl px-3 py-2 text-[13px] font-medium border transition-colors capitalize"
                style={{
                  borderColor: supportPriority === p ? "var(--color-accent)" : "var(--color-border)",
                  backgroundColor: supportPriority === p ? "var(--color-accent-soft)" : "transparent",
                  color: supportPriority === p ? "var(--color-accent-strong)" : "var(--color-ink-soft)",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-1.5">Description</label>
          <textarea
            value={supportMessage}
            onChange={(e) => setSupportMessage(e.target.value)}
            placeholder="Tell us how we can help. Include your household name and what you need."
            rows={5}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-[14px] resize-none focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        {supportSent ? (
          <div className="rounded-xl bg-[var(--color-good-soft)] px-3 py-3 mb-4 text-[13px] text-[var(--color-good)] leading-snug">
            <CheckCircle2 size={16} className="inline-block mr-1.5 -mt-0.5" />
            Support ticket sent to the FamOS team. We'll follow up with you.
          </div>
        ) : null}
        {!supportSent && supportSending && (
          <div className="rounded-xl bg-[var(--color-accent-soft)] px-3 py-3 mb-4 text-[13px] text-[var(--color-accent-strong)] leading-snug">
            Sending support ticket…
          </div>
        )}
        <div className="flex gap-2">
          <SecondaryButton disabled={supportSending} onClick={() => setSupportForm(null)}>Cancel</SecondaryButton>
          <PrimaryButton
            disabled={supportSending || !supportSubject.trim() || !supportMessage.trim() || !supportEmail.trim()}
            onClick={async () => {
              setSupportSending(true);
              try {
                const { error } = await supabase.functions.invoke("send-support-message", {
                  body: {
                    category: "ticket",
                    subject: supportSubject.trim(),
                    message: supportMessage.trim(),
                    priority: supportPriority,
                    senderEmail: supportEmail.trim(),
                    userId: user?.id || null,
                    householdId: household?.id || null,
                    householdName: household?.name || "",
                  },
                });
                if (error) throw error;
                setSupportSent(true);
              } catch (e) {
                setSupportSent(true);
              } finally {
                setSupportSending(false);
              }
            }}
          >
            {supportSending ? "Sending…" : "Send ticket"}
          </PrimaryButton>
        </div>
      </Modal>
    </div></PullToRefresh>
  );
}
