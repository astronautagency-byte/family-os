import { useEffect, useRef, useState } from "react";
import { Check, Clock3, LockKeyhole, MessageCircle, Plus, Send, ShoppingCart, Trash2, UsersRound, X } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { useAuth } from "../context/AuthContext";
import { Avatar, colorVar, Modal, SecondaryButton } from "../components/ui";
import PageHeader from "../components/PageHeader";
import { detectIntent, intentKey } from "../lib/chatIntents";



function timeLabel(value) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Persisted per-user dismissal store — keeps the chat calm across reloads.
const DISMISS_KEY = "familyos:chat-dismissed-intents";
function loadDismissed(userId) {
  try {
    const raw = localStorage.getItem(`${DISMISS_KEY}:${userId || "anon"}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
}
function saveDismissed(userId, map) {
  try { localStorage.setItem(`${DISMISS_KEY}:${userId || "anon"}`, JSON.stringify(map)); } catch {}
}

function intentIcon(intent) {
  if (intent.kind === "grocery") return ShoppingCart;
  if (intent.kind === "task") return Check;
  if (intent.kind === "meal") return Clock3;
  if (intent.kind === "event") return Clock3;
  return Plus;
}

function intentLabel(intent) {
  if (intent.kind === "grocery") {
    const count = (intent.items || []).length;
    return count === 1
      ? `Add ${intent.items[0]} to groceries`
      : `Add ${count} items to groceries`;
  }
  if (intent.kind === "task") {
    return intent.due ? `Add task for ${formatDue(intent.due)}` : "Add to tasks";
  }
  if (intent.kind === "meal") {
    return `Add to ${intent.slot}${intent.when ? ` (${intent.when})` : ""}`;
  }
  if (intent.kind === "event") {
    return "Add to calendar";
  }
  return "Add to list";
}

function formatDue(iso) {
  try {
    const date = new Date(iso);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) return `today ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return `tomorrow ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}

function IntentChip({ intent, onAccept, onDismiss, status }) {
  const Icon = intentIcon(intent);
  return (
    <div className={`chat-intent-chip chat-intent-chip-${intent.kind}${status === "added" ? " added" : ""}`}>
      <span className="chat-intent-icon"><Icon size={12} /></span>
      <span className="chat-intent-copy">{intentLabel(intent)}{status !== "added" && <small>{intentDetail(intent)}</small>}</span>
      {status !== "added" ? (
        <>
          <button type="button" className="chat-intent-add" onClick={onAccept}>Add</button>
          <button type="button" className="chat-intent-dismiss" onClick={onDismiss} aria-label="Dismiss suggestion"><X size={12} /></button>
        </>
      ) : (
        <span className="chat-intent-added">Added</span>
      )}
    </div>
  );
}

function intentDetail(intent) {
  if (intent.kind === "grocery") return (intent.items || []).join(", ");
  if (intent.kind === "task") return intent.title;
  if (intent.kind === "meal") return intent.title;
  if (intent.kind === "event") return intent.title;
  return "";
}

export default function Chat() {
  const { user } = useAuth();
  const { members, memberById, messages, sendMessage, clearFamilyChat, clearMyDirectMessages, markChatRead, dataError, tabletMode, addGrocery, addTask, setMealForSlot, addEvent } = useFamily();
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(null); // "family" | "dms"
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState("");
  const [dismissedMap, setDismissedMap] = useState({});
  const [addedMap, setAddedMap] = useState({});
  const currentUserId = user?.id || members[0]?.id;
  const chatMembers = members.filter((member) => member.id !== currentUserId);
  const [activeThread, setActiveThread] = useState("household");
  const endRef = useRef(null);

  useEffect(() => {
    setDismissedMap(loadDismissed(currentUserId));
  }, [currentUserId]);

  useEffect(() => {
    if (tabletMode && activeThread !== "household") {
      setActiveThread("household");
      return;
    }
    if (activeThread !== "household" && !chatMembers.some((member) => member.id === activeThread)) {
      setActiveThread("household");
    }
  }, [members, activeThread, tabletMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeMember = activeThread === "household" ? null : memberById[activeThread];
  const threadMessages = messages.filter((message) => {
    if (activeThread === "household") return !message.recipientId;
    return (message.senderId === currentUserId && message.recipientId === activeThread)
      || (message.senderId === activeThread && message.recipientId === currentUserId);
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages.length, activeThread]);

  // Viewing the chat clears the unread badge. Only marks read on the first
  // render with messages loaded — not on every realtime update (which would
  // suppress the badge forever). The ref resets on unmount so re-entering
  // the chat tab also marks new messages read.
  const chatMountedRef = useRef(false);
  useEffect(() => {
    if (chatMountedRef.current || !messages.length) return;
    markChatRead?.();
    chatMountedRef.current = true;
  }, [messages, markChatRead]);

  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim() || !currentUserId || sending) return;
    setSending(true); setSendError("");
    try { await sendMessage({ text: text.trim(), recipientId: activeThread === "household" ? null : activeThread, senderId: currentUserId }); setText(""); }
    catch (e) { setSendError(e.message || "Message could not be sent."); }
    finally { setSending(false); }
  };

  const familyCount = messages.filter((message) => !message.recipientId).length;
  const myDmCount = messages.filter((message) => message.recipientId && (message.senderId === currentUserId || message.recipientId === currentUserId)).length;

  const runClear = async () => {
    if (!confirmClear || clearing) return;
    setClearing(true); setClearError("");
    try {
      if (confirmClear === "family") await clearFamilyChat();
      else await clearMyDirectMessages(currentUserId);
      setConfirmClear(null);
      setManageOpen(false);
    } catch (error) {
      setClearError(error.message || "Those messages could not be cleared.");
    } finally {
      setClearing(false); }
  };

  const acceptIntent = async (messageId, intent) => {
    try {
      if (intent.kind === "grocery") {
        for (const name of intent.items || []) {
          await addGrocery({ name });
        }
      } else if (intent.kind === "task") {
        await addTask({ title: intent.title, due: intent.due || null });
      } else if (intent.kind === "meal") {
        const today = new Date().toISOString().slice(0, 10);
        const date = (intent.date || today).slice(0, 10);
        await setMealForSlot(date, intent.slot, { title: intent.title });
      } else if (intent.kind === "event") {
        // Default the start to today 18:00 if no timing was extracted; calendar page lets users adjust.
        const startSource = intent.date ? new Date(intent.date) : new Date();
        if (!intent.date) startSource.setHours(18, 0, 0, 0);
        const start = startSource.toISOString();
        const end = new Date(startSource.getTime() + 60 * 60 * 1000).toISOString();
        await addEvent({ title: intent.title, start, end });
      }
      setAddedMap((prev) => ({ ...prev, [`${messageId}:${intentKey(messageId, intent)}`]: true }));
    } catch (err) {
      setSendError(err?.message || "Couldn't add this to your list.");
    }
  };

  const dismissIntent = (messageId, intent) => {
    const key = intentKey(messageId, intent);
    if (!key) return;
    setDismissedMap((prev) => {
      const next = { ...prev, [messageId]: { ...(prev[messageId] || {}), [key]: true } };
      saveDismissed(currentUserId, next);
      return next;
    });
  };

  return (
    <div className="h-screen pb-20 flex flex-col">
      <PageHeader eyebrow="Private conversations" title="Chat, minus the chaos." illustration="chat" subtitle="Quick decisions, saved from the scroll." />

      <div className="px-5 mt-1 mb-2 flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => { setActiveThread("household"); setSendError(""); }} className="shrink-0 flex items-center gap-2 rounded-full border pl-2 pr-3 py-1.5 transition-colors" style={{ borderColor: activeThread === "household" ? "var(--color-accent)" : "var(--color-border)", backgroundColor: activeThread === "household" ? "var(--color-accent-soft)" : "var(--color-surface)", color: activeThread === "household" ? "var(--color-accent-strong)" : "var(--color-ink-soft)" }}><span className="w-7 h-7 rounded-full bg-[var(--pastel-mint)] grid place-items-center"><UsersRound size={14} /></span><span className="text-[12.5px] font-semibold">Everyone</span></button>
        {!tabletMode&&chatMembers.map((member) => {
          const active = member.id === activeThread;
          return <button key={member.id} onClick={() => { setActiveThread(member.id); setSendError(""); }} className="shrink-0 flex items-center gap-2 rounded-full border pl-1.5 pr-3 py-1.5 transition-colors" style={{ borderColor: active ? "var(--color-accent)" : "var(--color-border)", backgroundColor: active ? "var(--color-accent-soft)" : "var(--color-surface)", color: active ? "var(--color-accent-strong)" : "var(--color-ink-soft)" }}><Avatar member={member} size="sm" /><span className="text-[12.5px] font-semibold">{member.name}</span></button>;
        })}
      </div>

      <div className="px-5 mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <LockKeyhole size={12} color="var(--color-ink-faint)" className="shrink-0" />
          <p className="text-[11.5px] text-[var(--color-ink-faint)] truncate">{tabletMode ? "Shared household messages only" : activeThread === "household" ? "The all-hands household thread" : activeMember ? `Private chat with ${activeMember.name}` : "Add another family member to start chatting"} · synced live</p>
        </div>
        <div className="chat-header-actions">
          <button type="button" className="chat-clear-trigger" onClick={() => { setClearError(""); setConfirmClear(null); setManageOpen(true); }} aria-label="Clear messages">
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>

      <div className="px-5 py-3 flex-1 overflow-y-auto space-y-3">
        {threadMessages.map((message) => {
          const sender = memberById[message.senderId];
          const mine = message.senderId === currentUserId;
          const intent = detectIntent(message.text);
          const intentKeyValue = intent ? intentKey(message.id, intent) : null;
          const dismissed = intent && intentKeyValue && dismissedMap[message.id]?.[intentKeyValue];
          const added = intent && intentKeyValue && addedMap[`${message.id}:${intentKeyValue}`];
          const showChip = intent && !dismissed && message.source !== "whatsapp";
          return (
            <div key={message.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine && sender && <Avatar member={sender} size="sm" />}
              <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                <div
                  className="px-3.5 py-2.5 text-[14px] leading-relaxed"
                  style={{
                    borderRadius: mine ? "18px 18px 5px 18px" : "18px 18px 18px 5px",
                    background: mine ? "var(--color-accent)" : "var(--color-surface)",
                    color: mine ? "white" : "var(--color-ink)",
                    border: mine ? "none" : "1px solid var(--color-border)",
                  }}
                >
                  {message.source === "whatsapp" && <span className="whatsapp-message-source"><MessageCircle size={11} /> WhatsApp · {message.sourceSender || "Imported"}</span>}
                  {message.text}
                </div>
                <span className="text-[10px] text-[var(--color-ink-faint)] mt-1 px-1">
                  {sender?.name} · {timeLabel(message.sentAt)}
                </span>
                {showChip && (
                  <IntentChip
                    intent={intent}
                    status={added ? "added" : "ready"}
                    onAccept={() => acceptIntent(message.id, intent)}
                    onDismiss={() => dismissIntent(message.id, intent)}
                  />
                )}
              </div>
            </div>
          );
        })}
        {threadMessages.length === 0 && <div className="h-full min-h-40 flex flex-col items-center justify-center text-center px-8">{activeMember ? <Avatar member={activeMember} size="lg" /> : <span className="w-14 h-14 rounded-full bg-[var(--pastel-mint)] grid place-items-center text-[var(--color-ink)"><UsersRound size={24} /></span>}<p className="text-[14px] font-medium mt-3">{activeMember ? `Say hi to ${activeMember.name}` : "Start the household chat"}</p><p className="text-[12px] text-[var(--color-ink-faint)] mt-1">Messages stay inside your shared home space.</p></div>}
        <div ref={endRef} />
      </div>

      {(sendError || dataError) && <p className="px-5 py-2 text-[12px] text-[var(--color-warn)]">{sendError || dataError}</p>}

      <form onSubmit={submit} className="px-4 py-3 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex items-center gap-2">
        <div className="shrink-0">{memberById[currentUserId] && <Avatar member={memberById[currentUserId]} />}</div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={activeThread === "household" ? "Tell everyone…" : activeMember ? `Message ${activeMember.name}` : "Select a family member"}
          disabled={activeThread !== "household" && !activeMember}
          className="min-w-0 flex-1 rounded-full bg-[var(--color-surface-sunken)] px-4 py-2.5 text-[14px] outline-none placeholder:text-[var(--color-ink-faint)]"
        />
        <button
          type="submit"
          disabled={!text.trim() || (activeThread !== "household" && !activeMember) || sending}
          className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-35"
          style={{ backgroundColor: colorVar(memberById[currentUserId]?.color) }}
          aria-label="Send message"
        >
          <Send size={17} color="white" />
        </button>
      </form>

      <Modal open={manageOpen} onClose={() => !clearing && setManageOpen(false)} title={confirmClear ? "Are you sure?" : "Clear messages"}>
        {!confirmClear ? (
          <div className="chat-clear-panel">
            <p className="chat-clear-intro">Clearing messages is permanent and cannot be undone.</p>
            <button type="button" className="chat-clear-option" onClick={() => { setClearError(""); setConfirmClear("family"); }}>
              <span><UsersRound size={18} /></span>
              <div><strong>Clear family chat</strong><small>Delete the shared household thread for everyone{familyCount ? ` · ${familyCount} message${familyCount === 1 ? "" : "s"}` : ""}.</small></div>
            </button>
            {!tabletMode && (
              <button type="button" className="chat-clear-option" onClick={() => { setClearError(""); setConfirmClear("dms"); }}>
                <span><LockKeyhole size={18} /></span>
                <div><strong>Clear my direct messages</strong><small>Delete only your 1:1 conversations{myDmCount ? ` · ${myDmCount} message${myDmCount === 1 ? "" : "s"}` : ""}.</small></div>
              </button>
            )}
            {clearError && <p className="chat-clear-error">{clearError}</p>}
          </div>
        ) : (
          <div className="chat-clear-panel">
            <p className="reset-confirm-copy">{confirmClear === "family"
              ? "This permanently deletes the shared family chat for every member of your household."
              : "This permanently deletes all of your direct-message conversations. Other members keep their own."}</p>
            {clearError && <p className="chat-clear-error">{clearError}</p>}
            <div className="reset-confirm-actions">
              <SecondaryButton onClick={() => setConfirmClear(null)} disabled={clearing}>Back</SecondaryButton>
              <button className="event-danger-button" onClick={runClear} disabled={clearing}><Trash2 size={16} /> {clearing ? "Clearing…" : confirmClear === "family" ? "Delete family chat" : "Delete my DMs"}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
