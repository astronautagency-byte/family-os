import { useEffect, useState } from "react";
import { AlertCircle, Bell, Bot, CalendarDays, CheckCircle2, ExternalLink, Eye, EyeOff, ImagePlus, Info, Link2, MapPin, Pencil, Plus, RefreshCw, RotateCcw, ShieldCheck, Trash2, Upload, Users, Utensils } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { useAuth } from "../context/AuthContext";
import { Avatar, Card, Modal, PrimaryButton, SecondaryButton, TextField } from "../components/ui";
import PageHeader from "../components/PageHeader";
import { FAMILY_COLORS } from "../data/mockData";
import { AVATAR_PRESETS } from "../data/avatarLibrary";
import { PRICING_PLAN, formatMoney } from "../data/pricingPlan";
import { supabase } from "../lib/supabase";

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
    googleConnected, googleStatus, googleError, googleLastSynced, googleEvents, googleCalendars, selectedGoogleCalendarIds,
    googleUsesAccount,
    connectGoogleCalendar, syncGoogleCalendarNow, disconnectGoogleCalendar, toggleGoogleCalendar,
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

      {googleConnected && googleCalendars.length > 0 && <div className="google-calendar-picker"><div><strong>Calendars to sync</strong><span>{selectedGoogleCalendarIds.length} of {googleCalendars.length} selected</span></div><ul>{googleCalendars.map(calendar=><li key={calendar.id}><button onClick={()=>toggleGoogleCalendar(calendar.id)} disabled={isBusy} aria-pressed={selectedGoogleCalendarIds.includes(calendar.id)}><i style={{backgroundColor:calendar.backgroundColor}}/><span><b>{calendar.summary}</b><small>{calendar.primary?"Primary calendar":calendar.accessRole==="reader"?"Read only":"Can add events"}</small></span><em>{selectedGoogleCalendarIds.includes(calendar.id)&&<CheckCircle2/>}</em></button></li>)}</ul></div>}
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
          <PrimaryButton onClick={syncGoogleCalendarNow} disabled={isBusy}>
            {googleStatus === "syncing" ? "Syncing…" : googleStatus === "error" ? "Reconnect Google" : "Sync now"}
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

export default function Settings() {
  const { members, addMember, updateMember, removeMember, resetToDemoData, notificationPermission, requestNotifications, sendTestNotification } = useFamily();
  const { configured, user, household, householdProfileExtra, memberProfile, updateHouseholdSettings, invitePartner, updatePassword, signOut, deleteAccount } = useAuth();
  const [editingMember, setEditingMember] = useState(null); // member object or "new"
  const [name, setName] = useState("");
  const [role, setRole] = useState("Kid");
  const [color, setColor] = useState(FAMILY_COLORS[0].id);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarStatus, setAvatarStatus] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
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
  const [householdCountry, setHouseholdCountry] = useState("");
  const [householdDietary, setHouseholdDietary] = useState([]);
  const [householdAvoid, setHouseholdAvoid] = useState("");
  const [householdSaving, setHouseholdSaving] = useState(false);
  const [householdStatus, setHouseholdStatus] = useState("");

  const openHouseholdEditor = () => {
    setHouseholdName(household?.name || "");
    setHouseholdCity(householdProfileExtra?.city || "");
    setHouseholdCountry(householdProfileExtra?.country || "");
    setHouseholdDietary(householdProfileExtra?.dietaryRestrictions || []);
    setHouseholdAvoid(householdProfileExtra?.avoidIngredients || "");
    setHouseholdStatus("");
    setEditingHousehold(true);
  };

  const saveHousehold = async () => {
    setHouseholdSaving(true);
    setHouseholdStatus("");
    try {
      await updateHouseholdSettings({
        name: householdName,
        city: householdCity,
        country: householdCountry,
        dietaryRestrictions: householdDietary,
        avoidIngredients: householdAvoid,
      });
      setEditingHousehold(false);
    } catch (error) {
      setHouseholdStatus(error.message || "Could not update household details.");
    } finally {
      setHouseholdSaving(false);
    }
  };

  const loadPendingInvites = async () => {
    if (!configured || !household?.id || !supabase) return;
    let { data, error } = await supabase.from("household_invitations").select("id,email,phone,expires_at").eq("household_id", household.id).is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at");
    if (error && /phone|schema cache|column/i.test(error.message || "")) {
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
    if (!inviteEmail.trim() || inviting) return;
    if (invitePhone.trim() && !inviteSmsConsent) {
      setInviteStatus("Confirm that this person agreed to receive a one-time invitation by text.");
      return;
    }
    setInviting(true);
    setInviteStatus("");
    setSmsFallbackUrl("");
    try {
      const result = await invitePartner(inviteEmail, invitePhone);
      setInviteStatus(result?.message || "Invitation sent.");
      if (invitePhone.trim() && result?.sms?.requested && !result.sms.sent) {
        const normalizedPhone = invitePhone.replace(/[^\d+]/g, "");
        const joinUrl = `${window.location.origin}/signin?invited=1&email=${encodeURIComponent(inviteEmail.trim().toLowerCase())}`;
        const message = `You’re invited to ${household?.name || "a family home"} on FamOS. Join your family home: ${joinUrl} Reply STOP to opt out.`;
        const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? "&" : "?";
        setSmsFallbackUrl(`sms:${normalizedPhone}${separator}body=${encodeURIComponent(message)}`);
      }
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
      const result = await invitePartner(invite.email, invite.phone || "");
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
  const includedMembers = PRICING_PLAN.basePlan.membersIncluded;
  const isMasterOwner = household?.created_by
    ? household.created_by === user?.id
    : household?.role === "owner";
  const extraMembers = Math.max(0, members.length - includedMembers);
  const estimatedMonthlyPlan = PRICING_PLAN.basePlan.price.monthly + extraMembers * PRICING_PLAN.basePlan.additionalMemberPrice.monthly;

  return (
    <div className="pb-24 reference-settings">
      <PageHeader eyebrow="Household" title="Settings" illustration="settings" subtitle="Tweak the home base without making it a whole thing." />

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
            {isMasterOwner && <button className="settings-household-edit" onClick={openHouseholdEditor}><Pencil size={14} /> Edit</button>}
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
                  <div className="family-invite-avatar">{invite.email.slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1"><p>{invite.email}</p><span>{invite.phone ? `${invite.phone} · ` : ""}Still waiting for them to join</span></div>
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
                <TextField type="email" label="Invite a family member" placeholder="family@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                <TextField type="tel" label="Mobile number (optional)" placeholder="+1 416 555 0123" value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} autoComplete="tel" />
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
                <PrimaryButton type="submit" disabled={inviting || !inviteEmail.trim() || (Boolean(invitePhone.trim()) && !inviteSmsConsent)}>{inviting ? "Sending invitation…" : "Send invite"}</PrimaryButton>
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
                <p className="font-medium text-[14.5px] text-[var(--color-ink)]">FamOS family plan</p>
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
                <span className="inline-flex items-center gap-1.5"><Bot size={14} /> Fam AI add-on</span>
                <strong className="text-[var(--color-ink)]">{formatMoney(PRICING_PLAN.addOns[0].price.monthly)}/mo · {PRICING_PLAN.addOns[0].queryCapPerMonth} queries</strong>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-[var(--color-good-soft)] px-3 py-2 text-[var(--color-good)]">
                <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                <span>{PRICING_PLAN.trial.days}-day trial includes the full base plan and Fam AI turned on. Card required.</span>
              </div>
            </div>
            <SecondaryButton onClick={() => { window.location.hash = "pricing"; }} className="mt-3">View pricing page</SecondaryButton>
          </Card>
        </section>

        <section>
          <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)] mb-3">Integrations</h2>
          <GoogleCalendarCard />
          <CalendarFeedsCard />
        </section>

        <section>
          <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)] mb-3">Notifications</h2>
          <Card className="p-4">
            <div className="flex items-start gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0"><Bell size={18} color="var(--color-accent)" /></div><div><p className="font-medium text-[14.5px]">Household notifications</p><p className="text-[12.5px] text-[var(--color-ink-soft)] mt-0.5">Get notified about assigned tasks and meals, chat messages, groceries, and family calendar updates on every enabled device.</p></div></div>
            <PrimaryButton onClick={requestNotifications} disabled={notificationPermission === "granted" || notificationPermission === "unsupported"}>{notificationPermission === "granted" ? "Browser notifications allowed" : notificationPermission === "denied" ? "Blocked in browser settings" : notificationPermission === "unsupported" ? "Not supported on this device" : "Enable browser notifications"}</PrimaryButton>
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
                {configured ? "Your household data is encrypted in transit and stored in Supabase. Row-level security limits access to members of your household." : "FamOS is in local demo mode. Add Supabase environment variables to turn on private household sync."}
              </p>
            </div>
            {!configured && <SecondaryButton onClick={() => setConfirmingReset(true)} className="flex items-center justify-center gap-2">
              <RotateCcw size={15} /> Reset to demo data
            </SecondaryButton>}
            {configured && <SecondaryButton onClick={signOut}>Sign out</SecondaryButton>}
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

      <Modal open={!!memberToRemove} onClose={() => { if (!removingMember) setMemberToRemove(null); }} title={`Remove ${memberToRemove?.name || "family member"}?`}>
        <p className="text-[14px] text-[var(--color-ink-soft)] mb-2">
          They will immediately lose access to {household?.name || "this household"} and its calendar, tasks, meals, groceries and chat.
        </p>
        <p className="text-[12px] text-[var(--color-ink-faint)] mb-5">
          Their FamOS login will not be deleted. You can invite them back later.
        </p>
        {removeMemberError && <p className="text-[12.5px] text-[var(--color-warn)] mb-3">{removeMemberError}</p>}
        <div className="flex gap-2">
          <SecondaryButton disabled={removingMember} onClick={() => setMemberToRemove(null)}>Cancel</SecondaryButton>
          <PrimaryButton
            disabled={removingMember}
            onClick={async () => {
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
          >
            {removingMember ? "Removing…" : "Remove member"}
          </PrimaryButton>
        </div>
      </Modal>

      {/* Reset confirmation */}
      <Modal open={confirmingReset} onClose={() => setConfirmingReset(false)} title="Reset to demo data?">
        <p className="text-[14px] text-[var(--color-ink-soft)] mb-5">
          This replaces your current family members, calendar, meals, groceries, and tasks with the original demo
          data. This can't be undone.
        </p>
        <div className="flex gap-2">
          <SecondaryButton onClick={() => setConfirmingReset(false)}>Cancel</SecondaryButton>
          <PrimaryButton
            onClick={() => {
              resetToDemoData();
              setConfirmingReset(false);
            }}
          >
            Reset
          </PrimaryButton>
        </div>
      </Modal>

      <Modal open={editingHousehold} onClose={() => setEditingHousehold(false)} title="Edit household">
        <TextField label="Household name" value={householdName} onChange={(event) => setHouseholdName(event.target.value)} placeholder="e.g. The Miller Family" />
        <div className="settings-location-fields">
          <TextField label="City" value={householdCity} onChange={(event) => setHouseholdCity(event.target.value)} placeholder="e.g. Toronto" autoComplete="address-level2" />
          <TextField label="Country" value={householdCountry} onChange={(event) => setHouseholdCountry(event.target.value)} placeholder="e.g. Canada" autoComplete="country-name" />
        </div>
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
          <PrimaryButton onClick={saveHousehold} disabled={householdSaving || !householdName.trim()}>{householdSaving ? "Saving…" : "Save household"}</PrimaryButton>
        </div>
      </Modal>

      <Modal open={confirmingDelete} onClose={() => { if (!deleting) setConfirmingDelete(false); }} title={isMasterOwner ? "Permanently delete this household?" : "Leave this household?"}>
        <div className="w-11 h-11 rounded-xl bg-[var(--color-warn-soft)] flex items-center justify-center mb-4"><Trash2 size={19} color="var(--color-warn)" /></div>
        <p className="text-[13.5px] text-[var(--color-ink-soft)] leading-relaxed mb-4">{isMasterOwner ? "As the master owner, this permanently deletes the entire household—including tasks, expenses, meals, groceries, calendar events, chat, and memberships. Other members keep their personal FamOS logins." : "Your login and membership will be removed. The household and its shared data remain under the master owner."}</p>
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
