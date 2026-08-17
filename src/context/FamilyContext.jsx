import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  initialFamilyMembers,
  initialEvents,
  initialMeals,
  initialGroceries,
  initialTasks,
  initialMessages,
} from "../data/mockData";
import { createGoogleCalendarEvent, updateGoogleCalendarEvent as updateGoogleCalendarEventApi, deleteGoogleCalendarEvent as deleteGoogleCalendarEventApi, fetchGoogleCalendarEvents, fetchGoogleCalendars, requestGoogleAccessToken, revokeGoogleAccessToken } from "../lib/googleCalendar";
import { fetchIcalFeed, parseIcalEvents } from "../lib/icalCalendar";
import { useAuth } from "./AuthContext";
import { invokeEdgeFunction, supabase } from "../lib/supabase";
import { pathFromPublicUrl as groceryPhotoPath } from "../lib/groceryPhotoUpload";
import { categorizeGroceryItem } from "../lib/groceryCategories";

const STORAGE_KEY = "family-os:v1";
const GOOGLE_STORAGE_KEY = "family-os:google:v1";
const CALENDAR_FEEDS_STORAGE_KEY = "family-os:calendar-feeds:v1";
const TASK_LISTS_FALLBACK_KEY = "family-os:task-lists-fallback:v1";
const AVATAR_OVERRIDES_KEY = "family-os:avatar-overrides:v1";
const VAPID_PUBLIC_KEY = "BK4WksXI5RRZqDhurNH8v2VbinrSKrBLzOA6xni__siwCbKjhtJ1T0N3GOSVKKQPNAnENCacYtdlLW553fadxHQ";

function base64UrlToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Could not read saved Family OS data, starting fresh.", e);
  }
  return null;
}

// Local state survives app upgrades and may contain an older object-shaped or
// partially-written collection. Every consumer expects arrays, so normalize at
// the provider boundary before a page gets a chance to render it.
const savedList = (value, fallback = []) => Array.isArray(value)
  ? value.filter((item) => item && typeof item === "object")
  : fallback;

function loadGoogleState() {
  try {
    const raw = localStorage.getItem(GOOGLE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Could not read saved Google Calendar settings.", e);
  }
  return null;
}

function loadCalendarFeedState() {
  try {
    const raw = localStorage.getItem(CALENDAR_FEEDS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Could not read saved calendar feeds.", e);
  }
  return { feeds: [], events: [] };
}

function loadAvatarOverrides() {
  try {
    const raw = localStorage.getItem(AVATAR_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn("Could not read saved avatar choices.", e);
    return {};
  }
}

function saveAvatarOverride(memberId, avatarUrl) {
  if (!memberId) return;
  try {
    const overrides = loadAvatarOverrides();
    if (avatarUrl) overrides[memberId] = avatarUrl;
    else delete overrides[memberId];
    localStorage.setItem(AVATAR_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.warn("Could not save avatar choice locally.", e);
  }
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function readFallbackTaskLists(householdId) {
  try {
    const all = JSON.parse(localStorage.getItem(TASK_LISTS_FALLBACK_KEY) || "{}");
    return Array.isArray(all[householdId]) ? all[householdId] : [];
  } catch { return []; }
}

function writeFallbackTaskLists(householdId, lists) {
  try {
    const all = JSON.parse(localStorage.getItem(TASK_LISTS_FALLBACK_KEY) || "{}");
    all[householdId] = lists;
    localStorage.setItem(TASK_LISTS_FALLBACK_KEY, JSON.stringify(all));
  } catch { /* storage unavailable */ }
}

function isMissingTaskListsSchema(error) {
  return /task_lists|list_id|schema cache|relation .* does not exist|could not find the table/i.test(error?.message || "");
}

// Capitalise every word in a shopping list name so entries read consistently
// ("sourdough bread" → "Sourdough Bread"). Preserves common brand-style
// casing (e.g. "McCormick" stays as-is). Applied centrally in addGrocery so
// every call site — manual add, staple add, ingredient cross-reference,
// barcode scan — inherits the rule without code duplication.
const titleCaseGrocery = (name) => {
  const raw = String(name || "").trim();
  if (!raw) return raw;
  return raw.replace(/\b(\w)(\w*)\b/g, (_, first, rest) => {
    // Skip words that look like brands with internal caps (McCormick, O'Brien)
    // — they already have intentional casing.
    if (/[A-Z]/.test(rest)) return first + rest;
    return first.toUpperCase() + rest.toLowerCase();
  });
};

// Emoji reactions a family member can tap on a broadcast.
export const BROADCAST_REACTIONS = ["❤️", "👍", "😄", "🎉"];

async function getNotificationRegistration(timeoutMs = 900) {
  if (!("serviceWorker" in navigator)) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => {
      window.setTimeout(() => resolve(null), timeoutMs);
    }),
  ]).catch(() => null);
}

function showLocalNotification(title, options) {
  const notice = new Notification(title, options);
  notice.onclick = () => {
    window.focus();
    window.location.hash = options.data?.url?.replace("/#", "") || "today";
    notice.close();
  };
  return notice;
}

const FamilyContext = createContext(null);

export function FamilyProvider({ children, tabletMode = false }) {
  const { configured, household, user, googleProviderToken, signInWithGoogle, forceReconnectGoogle } = useAuth();
  const remote = Boolean(configured && household?.id && user?.id && supabase);
  const saved = loadState();
  const savedGoogle = loadGoogleState();
  const savedCalendarFeeds = loadCalendarFeedState();

  const [members, setMembers] = useState(() => savedList(saved?.members, initialFamilyMembers));
  const [events, setEvents] = useState(() => savedList(saved?.events, initialEvents));
  const [meals, setMeals] = useState(() => savedList(saved?.meals, initialMeals));
  const [groceries, setGroceries] = useState(() => savedList(saved?.groceries, initialGroceries));
  const [groceryLists, setGroceryLists] = useState(() => savedList(saved?.groceryLists));
  const [tasks, setTasks] = useState(() => savedList(saved?.tasks, initialTasks));
  const [taskLists, setTaskLists] = useState(() => savedList(saved?.taskLists));
  const [messages, setMessages] = useState(() => savedList(saved?.messages, initialMessages));
  const [messageReactions, setMessageReactions] = useState(() => savedList(saved?.messageReactions));
  const [expenses, setExpenses] = useState(() => savedList(saved?.expenses));
  const [weeklyBudget, setWeeklyBudgetState] = useState(saved?.weeklyBudget ?? 0);
  const [monthlyBudget, setMonthlyBudgetState] = useState(saved?.monthlyBudget ?? 0);
  const [financePeriod, setFinancePeriodState] = useState(saved?.financePeriod ?? "weekly");
  const [dataLoading, setDataLoading] = useState(remote);
  const [dataError, setDataError] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [calendarFeeds, setCalendarFeeds] = useState(savedCalendarFeeds.feeds || []);
  const [feedEvents, setFeedEvents] = useState(savedCalendarFeeds.events || []);
  const [calendarFeedStatus, setCalendarFeedStatus] = useState("idle");
  const [calendarFeedError, setCalendarFeedError] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(CALENDAR_FEEDS_STORAGE_KEY, JSON.stringify({ feeds: calendarFeeds, events: feedEvents }));
    } catch (e) {
      console.warn("Could not save calendar feeds.", e);
    }
  }, [calendarFeeds, feedEvents]);

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return "unsupported";
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted" && remote && "PushManager" in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
          });
        }
        const deviceLabel = [navigator.userAgentData?.platform || navigator.platform, /iPhone|iPad/.test(navigator.userAgent) ? "iOS Home Screen" : ""].filter(Boolean).join(" · ");
        const { error } = await supabase.from("push_subscriptions").upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          subscription: subscription.toJSON(),
          device_label: deviceLabel,
        }, { onConflict: "user_id,endpoint" });
        if (error) throw error;
      } catch (error) {
        console.warn("Could not register this device for background push.", error);
      }
    }
    return permission;
  };

  const sendHouseholdPush = (notification, targetUserIds = []) => {
    if (!remote) return;
    supabase.functions.invoke("send-household-push", {
      body: { householdId: household.id, targetUserIds: targetUserIds.filter(Boolean), notification },
    }).then(({ error }) => {
      if (error) console.warn("Could not send household push.", error);
    });
  };

  useEffect(() => {
    if (remote && notificationPermission === "granted") requestNotifications();
  }, [remote, notificationPermission, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendTestNotification = async () => {
    if (typeof Notification === "undefined") return "unsupported";
    let permission = Notification.permission;
    if (permission === "default") permission = await requestNotifications();
    if (permission !== "granted") return permission;
    const options = { body: "Notifications are ready. Tap to return to your family dashboard.", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "familyos-test", data: { url: "/#today" } };
    const registration = await getNotificationRegistration();
    if (registration?.showNotification) {
      await registration.showNotification("FamilyOS notifications are working", options);
      return "shown";
    }
    showLocalNotification("FamilyOS notifications are working", options);
    return "shown";
  };

  const showHouseholdNotification = async ({ title, body, tag, url }) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const options = { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag, data: { url }, renotify: true };
    const registration = await getNotificationRegistration();
    if (registration) await registration.showNotification(title, options);
    else showLocalNotification(title, options);
  };

  const notifyFromChange = (table, payload) => {
    const row = payload.new || {};
    if (!row.id || payload.eventType === "DELETE") return;
    if (table === "tasks") {
      if (row.created_by === user.id || row.assignee_id !== user.id) return;
      showHouseholdNotification({
        title: payload.eventType === "UPDATE" ? "Task updated" : "New task assigned",
        body: row.due_date ? `${row.title} · Due ${row.due_date}` : row.title,
        tag: `task-${row.id}`,
        url: "/#tasks",
      });
      return;
    }
    if (table === "messages") {
      if (row.sender_id === user.id || (row.recipient_id && row.recipient_id !== user.id)) return;
      const sender = memberById[row.sender_id]?.name || "A family member";
      showHouseholdNotification({ title: `${sender} sent a message`, body: row.body, tag: `message-${row.id}`, url: "/#chat" });
      return;
    }
    if (table === "grocery_items") {
      if (row.added_by === user.id || payload.eventType !== "INSERT") return;
      const sender = memberById[row.added_by]?.name || "A family member";
      showHouseholdNotification({ title: "Grocery added", body: `${sender} added ${row.name}`, tag: `grocery-${row.id}`, url: "/#groceries" });
      return;
    }
    if (table === "meals") {
      if (row.created_by === user.id) return;
      const cooks = row.cook_ids || [];
      if (cooks.length && !cooks.includes(user.id)) return;
      showHouseholdNotification({ title: cooks.includes(user.id) ? "Meal assigned to you" : "Meal plan updated", body: `${row.title || "A meal"} · ${row.meal_date} ${row.slot}`, tag: `meal-${row.id}`, url: "/#meals" });
      return;
    }
    if (table === "events") {
      if (row.created_by === user.id || payload.eventType !== "INSERT") return;
      showHouseholdNotification({ title: "Family calendar updated", body: row.title, tag: `event-${row.id}`, url: "/#calendar" });
    }
  };

  useEffect(() => {
    if (remote) return;
    const payload = JSON.stringify({ members, events, meals, groceries, groceryLists, tasks, taskLists, messages, messageReactions, expenses, weeklyBudget, monthlyBudget, financePeriod });
    try {
      localStorage.setItem(STORAGE_KEY, payload);
    } catch (e) {
      console.warn("Could not save Family OS data locally.", e);
    }
  }, [members, events, meals, groceries, groceryLists, tasks, taskLists, messages, messageReactions, expenses, weeklyBudget, monthlyBudget, financePeriod, remote]);

  const mapProfile = (row, membershipRole) => ({
    id: row.id,
    name: row.display_name || row.email,
    email: row.email || "",
    role: membershipRole === "owner" ? "Household owner" : "Family member",
    color: row.color,
    initials: row.initials,
    avatarUrl: loadAvatarOverrides()[row.id] || row.avatar_url || (row.id === user?.id ? user.user_metadata?.avatar_url || user.user_metadata?.picture || "" : ""),
  });
  const mapTask = (row) => ({ id: row.id, title: row.title, notes: row.notes || "", assigneeId: row.assignee_id, due: row.due_date, done: row.is_done, recurring: row.recurrence, taskType: row.task_type || "home", listId: row.list_id || null, createdBy: row.created_by || null });
  const mapTaskList = (row) => ({ id: row.id, name: row.name, color: row.color || "#6b5ce7", createdBy: row.created_by || null });
  const mapGroceryList = (row) => ({ id: row.id, name: row.name, color: row.color || "#3b8c75", createdBy: row.created_by || null });
  // image_url = OpenFoodFacts product catalogue image (read-only metadata
  // from a barcode scan). photo_url = the household member's own upload,
  // stored in the grocery-photos bucket and synced realtime. Two fields
  // exists on purpose: a stale catalogue image should not leak into the
  // slot reserved for the family snap of "this exact loaf of bread".
  const mapGrocery = (row) => ({
    id: row.id,
    name: row.name,
    category: categorizeGroceryItem(row.name, row.category),
    quantity: Number(row.quantity),
    unit: row.unit,
    checked: row.is_checked,
    addedBy: row.added_by,
    barcode: row.barcode || "",
    brand: row.brand || "",
    price: row.price == null ? null : Number(row.price),
    imageUrl: row.image_url || "",
    photoUrl: row.photo_url || "",
    photoUploadedBy: row.photo_uploaded_by || null,
    photoUploadedAt: row.photo_uploaded_at || null,
    listId: row.list_id || null,
  });
  const mapEvent = (row) => ({ id: row.id, title: row.title, start: row.starts_at, end: row.ends_at, location: row.location, recurrence: row.recurrence || "none", recurrenceUntil: row.recurrence_until || "", source: row.source === "familyos" ? "local" : row.source, externalId: row.external_id || null, googleEventId: row.source === "google" ? row.external_id || null : null, calendarId: row.external_calendar_id || null, memberIds: (row.event_participants || []).map((p) => p.user_id) });
  const mapMeal = (row) => ({ id: row.id, date: row.meal_date, slot: row.slot, title: row.title, notes: row.notes, cookIds: row.cook_ids || [], createdBy: row.created_by || null });
  const mapMessage = (row) => ({ id: row.id, senderId: row.sender_id, recipientId: row.recipient_id || null, text: row.body, sentAt: row.created_at, source: row.source || "famos", sourceSender: row.source_sender || "", broadcast: row.broadcast === true || row.source_sender === "__famos_broadcast__" });
  const mapReaction = (row) => ({ id: row.id, messageId: row.message_id, memberId: row.member_id, reaction: row.reaction, createdAt: row.created_at });
  const mapExpense = (row) => ({
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    category: row.category,
    spentOn: row.spent_on,
    createdBy: row.created_by,
    merchant: row.merchant || "",
    receiptNotes: row.receipt_notes || "",
    receiptConfidence: row.receipt_confidence || null,
    receiptSource: row.receipt_source || "manual",
  });

  const loadRemoteData = async () => {
    if (!remote) return;
    setDataLoading(true); setDataError(null);
    try {
      const [membersResult, tasksResult, groceriesResult, eventsResult, mealsResult, messagesResult] = await Promise.all([
        supabase.from("household_members").select("role, joined_at, profiles(*)").eq("household_id", household.id).order("joined_at"),
        supabase.from("tasks").select("*").eq("household_id", household.id).order("created_at"),
        supabase.from("grocery_items").select("*").eq("household_id", household.id).order("created_at"),
        supabase.from("events").select("*, event_participants(user_id)").eq("household_id", household.id).order("starts_at"),
        supabase.from("meals").select("*").eq("household_id", household.id).order("meal_date"),
        supabase.from("messages").select("*").eq("household_id", household.id).order("created_at"),
      ]);
      const failed = [membersResult, tasksResult, groceriesResult, eventsResult, mealsResult, messagesResult].find((result) => result.error);
      if (failed) throw failed.error;
      setMembers(membersResult.data.filter((item) => item.profiles).map((item) => mapProfile(item.profiles, item.role)));
      setTasks(tasksResult.data.map(mapTask)); setGroceries(groceriesResult.data.map(mapGrocery));
      setEvents(eventsResult.data.map(mapEvent)); setMeals(mealsResult.data.map(mapMeal)); setMessages(messagesResult.data.map(mapMessage));
      const taskListsResult = await supabase.from("task_lists").select("*").eq("household_id", household.id).order("created_at");
      if (!taskListsResult.error) {
        const remoteLists = taskListsResult.data.map(mapTaskList);
        const fallbackLists = readFallbackTaskLists(household.id);
        setTaskLists([...remoteLists, ...fallbackLists.filter((local) => !remoteLists.some((saved) => saved.id === local.id))]);
      } else if (isMissingTaskListsSchema(taskListsResult.error)) {
        setTaskLists(readFallbackTaskLists(household.id));
      }
      const groceryListsResult = await supabase.from("grocery_lists").select("*").eq("household_id", household.id).order("created_at");
      if (!groceryListsResult.error) setGroceryLists(groceryListsResult.data.map(mapGroceryList));
      const [expensesResult, financeResult] = await Promise.all([
        supabase.from("expenses").select("*").eq("household_id", household.id).order("spent_on", { ascending: false }),
        supabase.from("household_finance_settings").select("weekly_budget, monthly_budget, tracking_period").eq("household_id", household.id).maybeSingle(),
      ]);
      if (!expensesResult.error) setExpenses(expensesResult.data.map(mapExpense));
      if (!financeResult.error) {
        setWeeklyBudgetState(Number(financeResult.data?.weekly_budget || 0));
        setMonthlyBudgetState(Number(financeResult.data?.monthly_budget || 0));
        setFinancePeriodState(financeResult.data?.tracking_period || "weekly");
      }
      // Reactions are optional — a missing table (pre-migration) must not block the rest.
      const reactionsResult = await supabase.from("message_reactions").select("*").eq("household_id", household.id);
      if (!reactionsResult.error) setMessageReactions(reactionsResult.data.map(mapReaction));
    } catch (e) { setDataError(e.message || "Could not load household data."); }
    finally { setDataLoading(false); }
  };

  useEffect(() => { loadRemoteData(); }, [remote, household?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime channel is the primary data path — it delivers every INSERT,
  // UPDATE, and DELETE as they happen. The visibility-change handler only
  // does a full re-fetch when the channel was disconnected while the tab was
  // hidden (browsers throttle background WebSocket frames), so returning to
  // a healthy channel costs zero network requests. The hasFocus gate prevents
  // spurious reloads on internal tab switches.
  useEffect(() => {
    if (!remote) return undefined;
    const refreshOnReturn = () => {
      if (document.visibilityState !== "visible") return;
      if (typeof document.hasFocus === "function" && !document.hasFocus()) return;
      // Defensively reload — iOS / Android aggressively throttle background
      // WebSocket frames, so we cannot trust realtime to be gap-free after
      // a long absence. A full reload keeps the user honest without
      // doubling network on healthy tabs (still only fires when the tab
      // actually returns to the foreground).
      loadRemoteData();
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    window.addEventListener("focus", refreshOnReturn);
    return () => {
      document.removeEventListener("visibilitychange", refreshOnReturn);
      window.removeEventListener("focus", refreshOnReturn);
    };
  }, [remote, household?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Apply a single postgres_changes payload to the matching state setter,
  // avoiding a full loadRemoteData() re-fetch on every incremental change.
  const applyChange = useCallback((table, payload) => {
    const { eventType, new: row } = payload;
    if (!row?.id && eventType !== "DELETE") return;
    const insert = (setter, mapper) => setter((prev) => prev.some((item) => item.id === row.id) ? prev : [...prev, mapper(row)]);
    const update = (setter, mapper) => setter((prev) => prev.map((item) => item.id === row.id ? mapper(row) : item));
    const remove = (setter) => setter((prev) => prev.filter((item) => item.id !== payload.old?.id));
    const handle = (setter, mapper) => {
      if (eventType === "DELETE") remove(setter);
      else if (eventType === "UPDATE") update(setter, mapper);
      else insert(setter, mapper);
    };
    switch (table) {
      case "tasks": handle(setTasks, mapTask); break;
      case "task_lists": handle(setTaskLists, mapTaskList); break;
      case "grocery_items": handle(setGroceries, mapGrocery); break;
      case "events": handle(setEvents, (r) => ({ ...mapEvent(r), memberIds: r.event_participants?.map?.((p) => p.user_id) || [] })); break;
      case "meals": handle(setMeals, mapMeal); break;
      case "messages": handle(setMessages, mapMessage); break;
      case "message_reactions": handle(setMessageReactions, mapReaction); break;
      case "expenses": handle(setExpenses, mapExpense); break;
      case "kitchen_inventory":
        window.dispatchEvent(new CustomEvent("famos:kitchen-inventory-remote-change", { detail: payload }));
        break;
    }
  }, []); // map*/set* identities are stable across renders

  // Supabase recommends private Broadcast for the lowest-latency database
  // fan-out. Postgres Changes remains subscribed below as a durable fallback;
  // matching row ids make the two delivery paths naturally idempotent.
  const applyBroadcastChange = useCallback((eventType, envelope) => {
    const change = envelope?.payload || envelope || {};
    if (!change.table) return;
    applyChange(change.table, {
      eventType: change.operation || change.type || eventType,
      new: change.record || change.new || null,
      old: change.old_record || change.old || null,
    });
  }, [applyChange]);

  // Tracks realtime channel health so the visibility-change handler can
  // skip a full reload when the channel has been delivering events normally.
  const channelHealthyRef = useRef(true);
  // Stable channel-setup helper that can be re-invoked on reconnect.
  const setupChannel = useCallback(() => {
    if (!supabase) return null;
    const ch = supabase.channel(`household:${household.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `household_id=eq.${household.id}` }, (payload) => { notifyFromChange("tasks", payload); applyChange("tasks", payload); })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_lists", filter: `household_id=eq.${household.id}` }, (payload) => applyChange("task_lists", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "grocery_items", filter: `household_id=eq.${household.id}` }, (payload) => { notifyFromChange("grocery_items", payload); applyChange("grocery_items", payload); })
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `household_id=eq.${household.id}` }, (payload) => { if (payload.eventType === "INSERT") notifyFromChange("events", payload); applyChange("events", payload); })
      .on("postgres_changes", { event: "*", schema: "public", table: "event_participants" }, (payload) => loadRemoteData())
      .on("postgres_changes", { event: "*", schema: "public", table: "meals", filter: `household_id=eq.${household.id}` }, (payload) => { notifyFromChange("meals", payload); applyChange("meals", payload); })
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `household_id=eq.${household.id}` }, (payload) => { if (payload.eventType === "INSERT") notifyFromChange("messages", payload); applyChange("messages", payload); })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions", filter: `household_id=eq.${household.id}` }, (payload) => applyChange("message_reactions", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `household_id=eq.${household.id}` }, (payload) => applyChange("expenses", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "household_members", filter: `household_id=eq.${household.id}` }, loadRemoteData)
      .on("postgres_changes", { event: "*", schema: "public", table: "household_finance_settings", filter: `household_id=eq.${household.id}` }, loadRemoteData)
      .on("postgres_changes", { event: "*", schema: "public", table: "household_invitations", filter: `household_id=eq.${household.id}` }, loadRemoteData)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_feeds", filter: `household_id=eq.${household.id}` }, loadRemoteData)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => loadRemoteData())
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") { channelHealthyRef.current = true; }
        else if (status === "CHANNEL_ERROR") { console.warn("[realtime] channel error", error); channelHealthyRef.current = false; }
        else if (status === "TIMED_OUT") { console.warn("[realtime] subscription timed out"); channelHealthyRef.current = false; }
        else if (status === "CLOSED") {
          console.warn("[realtime] channel closed — reconnecting in 2s");
          channelHealthyRef.current = false;
          // Auto-reconnect after a short delay.
          setTimeout(() => {
            if (channelRef.current) supabase.removeChannel(channelRef.current);
            channelRef.current = setupChannel();
          }, 2000);
        }
      });
    return ch;
  }, []); // Dependencies are captured via refs — don't re-create the channel on every render.
  const channelRef = useRef(null);
  const fastChannelRef = useRef(null);

  useEffect(() => {
    if (!remote) return undefined;
    channelRef.current = setupChannel();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      channelHealthyRef.current = false;
    };
  }, [remote, household?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!remote || !household?.id || !supabase?.realtime) return undefined;
    let cancelled = false;
    const start = async () => {
      try {
        await supabase.realtime.setAuth();
        if (cancelled) return;
        const topic = `household:${household.id}:changes`;
        const ch = supabase.channel(topic, { config: { private: true } })
          .on("broadcast", { event: "INSERT" }, (payload) => applyBroadcastChange("INSERT", payload))
          .on("broadcast", { event: "UPDATE" }, (payload) => applyBroadcastChange("UPDATE", payload))
          .on("broadcast", { event: "DELETE" }, (payload) => applyBroadcastChange("DELETE", payload))
          .subscribe((status) => {
            if (status === "SUBSCRIBED") fastChannelRef.current = ch;
          });
        fastChannelRef.current = ch;
      } catch {
        // The existing filtered Postgres Changes channel remains active.
      }
    };
    start();
    return () => {
      cancelled = true;
      if (fastChannelRef.current) supabase.removeChannel(fastChannelRef.current);
      fastChannelRef.current = null;
    };
  }, [remote, household?.id, applyBroadcastChange]);

  const runRemote = async (query) => { const { error } = await query; if (error) { setDataError(error.message); throw error; } };

  const memberById = useMemo(() => {
    const map = {};
    for (const m of members) map[m.id] = m;
    return map;
  }, [members]);

  // ---- Members ----
  const addMember = (member) =>
    setMembers((prev) => [...prev, { id: makeId("mem"), ...member }]);
  const updateMember = async (id, patch) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    if (patch.avatarUrl !== undefined) saveAvatarOverride(id, patch.avatarUrl);
    if (remote) {
      const dbPatch = {};
      if (patch.name !== undefined) dbPatch.display_name = patch.name;
      if (patch.color !== undefined) dbPatch.color = patch.color;
      if (patch.initials !== undefined) dbPatch.initials = patch.initials;
      if (patch.avatarUrl !== undefined) dbPatch.avatar_url = patch.avatarUrl;
      const { error } = await supabase.from("profiles").update(dbPatch).eq("id", id);
      if (error) {
        if (dbPatch.avatar_url !== undefined && /avatar_url|schema cache/i.test(error.message || "")) {
          const { avatar_url: _avatarUrl, ...profilePatchWithoutAvatar } = dbPatch;
          if (Object.keys(profilePatchWithoutAvatar).length) {
            const retry = await supabase.from("profiles").update(profilePatchWithoutAvatar).eq("id", id);
            if (retry.error) {
              console.warn("Could not sync profile update.", retry.error);
              setDataError(retry.error.message);
              return { error: retry.error };
            }
          }
          setDataError(null);
          return { error: null, localOnlyAvatar: true };
        }
        console.warn("Could not sync profile update.", error);
        setDataError(error.message);
        return { error };
      }
    }
    return { error: null };
  };
  const removeMember = async (id) => {
    if (remote) {
      const { data, error } = await supabase.functions.invoke("remove-household-member", {
        body: { targetUserId: id },
      });
      if (error) {
        let message = data?.error || error.message;
        try {
          if (error.context instanceof Response) {
            const details = await error.context.clone().json();
            message = details?.error || message;
          }
        } catch {
          // Keep the client error when the function did not return JSON.
        }
        const removalError = new Error(message || "Could not remove this family member.");
        setDataError(removalError.message);
        throw removalError;
      }
    }
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  // ---- Tasks ----
  const toggleTask = async (id) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    // Optimistic: flip local state immediately.
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    if (remote) {
      try { const { error } = await supabase.from("tasks").update({ is_done: !task.done }).eq("id", id); if (error) throw error; }
      catch { /* realtime will re-sync when healthy */ }
    }
  };
  const addTask = async (task) => {
    const tempId = makeId("task");
    // Optimistic: show the task instantly in all views.
    setTasks((prev) => [...prev, { id: tempId, done: false, taskType: "home", ...task }]);
    if (remote) {
      const row = { household_id: household.id, title: task.title, notes: task.notes || "", assignee_id: task.assigneeId || null, due_date: task.due || null, recurrence: task.recurring || "", task_type: task.taskType || "home", list_id: task.listId || null, created_by: user.id };
      let result = await supabase.from("tasks").insert(row).select().single();
      if (result.error && /task_type|notes|schema cache/i.test(result.error.message || "") && !task.listId) {
        const { task_type: _taskType, notes: _notes, ...compatibleRow } = row;
        result = await supabase.from("tasks").insert(compatibleRow).select().single();
      }
      if (result.error) {
        // Rollback: remove the optimistic item and surface the error.
        setTasks((prev) => prev.filter((item) => item.id !== tempId));
        setDataError(result.error.message);
        throw result.error;
      }
      // Replace optimistic item with server-confirmed data.
      setTasks((prev) => prev.map((item) => item.id === tempId ? mapTask(result.data) : item));
      sendHouseholdPush({ title: "New task assigned", body: task.title, tag: `task-${result.data.id}`, url: "/#tasks" }, task.assigneeId ? [task.assigneeId] : []);
    }
  };
  const updateTask = async (id, patch) => {
    const dbPatch = {};
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes;
    if (patch.assigneeId !== undefined) dbPatch.assignee_id = patch.assigneeId;
    if (patch.due !== undefined) dbPatch.due_date = patch.due;
    if (patch.done !== undefined) dbPatch.is_done = patch.done;
    if (patch.recurring !== undefined) dbPatch.recurrence = patch.recurring;
    if (patch.taskType !== undefined) dbPatch.task_type = patch.taskType;
    if (patch.listId !== undefined) dbPatch.list_id = patch.listId || null;
    if (remote) {
      let result = await supabase.from("tasks").update(dbPatch).eq("id", id).select().single();
      // Production may briefly trail the client while the custom-list schema
      // migration is queued. Do not let an unavailable list_id/task_type field
      // block ordinary edits such as assigning a task to another member.
      if (result.error && /task_type|notes|schema cache/i.test(result.error.message || "") && patch.listId === undefined) {
        const { task_type: _taskType, notes: _notes, ...compatiblePatch } = dbPatch;
        result = await supabase.from("tasks").update(compatiblePatch).eq("id", id).select().single();
      }
      if (result.error) {
        setDataError(result.error.message);
        throw result.error;
      }
    }
    if (remote && patch.assigneeId) sendHouseholdPush({ title: "Task assigned to you", body: patch.title || tasks.find((task) => task.id === id)?.title || "A household task", tag: `task-${id}`, url: "/#tasks" }, [patch.assigneeId]);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };
  const removeTask = async (id) => {
    // Optimistic: remove from local state immediately.
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (remote) {
      try { const { error } = await supabase.from("tasks").delete().eq("id", id); if (error) throw error; }
      catch { /* realtime will re-sync */ }
    }
  };
  const clearTasks = async () => {
    const snapshot = tasks;
    // Optimistic: clear instantly.
    setTasks([]);
    if (remote) {
      const { error } = await supabase.from("tasks").delete().eq("household_id", household.id);
      if (error) { setTasks(snapshot); setDataError(error.message); throw error; }
    }
  };
  const addTaskList = async ({ name, color = "#6b5ce7" }) => {
    const cleanName = name.trim();
    if (!cleanName) return null;
    const local = { id: makeId("tasklist"), name: cleanName, color, createdBy: user?.id || "me" };
    setTaskLists((prev) => [...prev, local]);
    if (remote) {
      const result = await supabase.from("task_lists").insert({ household_id: household.id, name: cleanName, color, created_by: user.id }).select().single();
      if (result.error && isMissingTaskListsSchema(result.error)) {
        const fallbackLists = [...readFallbackTaskLists(household.id).filter((list) => list.id !== local.id), local];
        writeFallbackTaskLists(household.id, fallbackLists);
        setDataError(null);
        return local;
      }
      if (result.error) { setTaskLists((prev) => prev.filter((list) => list.id !== local.id)); setDataError(result.error.message); throw result.error; }
      const savedList = mapTaskList(result.data);
      setTaskLists((prev) => prev.map((list) => list.id === local.id ? savedList : list));
      return savedList;
    }
    return local;
  };

  // ---- Groceries ----
  const addGroceryList = async ({ name, color = "#3b8c75" }) => {
    const cleanName = String(name || "").trim();
    if (!cleanName) return null;
    if (!remote) {
      const local = { id: makeId("grocerylist"), name: cleanName, color };
      setGroceryLists((current) => [...current, local]);
      return local;
    }
    const { data, error } = await supabase.from("grocery_lists").insert({ household_id: household.id, name: cleanName, color, created_by: user.id }).select().single();
    if (error) { setDataError(error.message); throw error; }
    const savedList = mapGroceryList(data);
    setGroceryLists((current) => [...current, savedList]);
    return savedList;
  };
  const removeGroceryList = async (id) => {
    const list = groceryLists.find((item) => item.id === id);
    if (!list) return;
    const previousLists = groceryLists;
    const previousGroceries = groceries;
    setGroceryLists((current) => current.filter((item) => item.id !== id));
    setGroceries((current) => current.map((item) => item.listId === id ? { ...item, listId: null } : item));
    if (remote) {
      const { error } = await supabase.from("grocery_lists").delete().eq("id", id).eq("household_id", household.id);
      if (error) {
        setGroceryLists(previousLists);
        setGroceries(previousGroceries);
        setDataError(error.message);
        throw error;
      }
    }
  };
  const toggleGrocery = async (id) => {
    // Optimistic: flip local state immediately.
    setGroceries((prev) => prev.map((g) => (g.id === id ? { ...g, checked: !g.checked } : g)));
    if (remote) {
      const item = groceries.find((g) => g.id === id);
      if (!item) return;
      try { const { error } = await supabase.from("grocery_items").update({ is_checked: !item.checked }).eq("id", id); if (error) throw error; }
      catch { /* realtime will re-sync */ }
    }
  };
  const addGrocery = async (item) => {
    const capitalized = titleCaseGrocery(item.name);
    const category = categorizeGroceryItem(capitalized, item.category);
    const tempId = makeId("gro");
    // Optimistic: show the item instantly.
    setGroceries((prev) => [...prev, { id: tempId, checked: false, quantity: 1, unit: "", ...item, name: capitalized, category }]);
    if (remote) {
      const row = {
        household_id: household.id,
        name: capitalized,
        category,
        quantity: item.quantity || 1,
        unit: item.unit || "",
        added_by: user.id,
        barcode: item.barcode || null,
        brand: item.brand || "",
        price: item.price ?? null,
        image_url: item.imageUrl || "",
        photo_url: item.photoUrl || "",
        photo_uploaded_by: item.photoUrl ? user.id : null,
        photo_uploaded_at: item.photoUrl ? new Date().toISOString() : null,
        list_id: item.listId || null,
      };
      let { data, error } = await supabase.from("grocery_items").insert(row).select().single();
      // Production households can briefly be on the base grocery schema
      // while the optional barcode/photo migrations are still rolling out.
      // A plain item must still save in that window: retry using only the
      // original required columns when PostgREST rejects a newer column.
      if (error && /schema cache|column|barcode|brand|price|image_url|photo_/i.test(error.message || "") && !item.listId) {
        const baseRow = {
          household_id: row.household_id,
          name: row.name,
          category: row.category,
          quantity: row.quantity,
          unit: row.unit,
          added_by: row.added_by,
        };
        ({ data, error } = await supabase.from("grocery_items").insert(baseRow).select().single());
      }
      if (error) {
        // Rollback: remove optimistic item.
        setGroceries((prev) => prev.filter((item) => item.id !== tempId));
        setDataError(error.message);
        throw error;
      }
      // Replace optimistic item with server-confirmed data.
      setGroceries((prev) => prev.map((item) => item.id === tempId ? mapGrocery(data) : item));
      sendHouseholdPush({ title: "Grocery added", body: item.name, tag: `grocery-${data.id}`, url: "/#groceries" });
    }
  };
  const updateGrocery = async (id, patch) => {
    if (patch.name) patch = { ...patch, name: titleCaseGrocery(patch.name) };
    // Optimistic: update local state immediately.
    setGroceries((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    if (remote) {
      const dbPatch = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.category !== undefined) dbPatch.category = patch.category;
      if (patch.quantity !== undefined) dbPatch.quantity = patch.quantity;
      if (patch.unit !== undefined) dbPatch.unit = patch.unit;
      if (patch.checked !== undefined) dbPatch.is_checked = patch.checked;
      if (patch.listId !== undefined) dbPatch.list_id = patch.listId || null;
      if (patch.brand !== undefined) dbPatch.brand = patch.brand || "";
      if (patch.imageUrl !== undefined) dbPatch.image_url = patch.imageUrl || "";
      // Photo fields are written together: when photoUrl is set we stamp
      // the uploader + timestamp, when it's cleared (null/empty) we wipe
      // both. previousPhotoUrl is optional — when the caller passes the
      // old URL we know to clean up the underlying Storage object after
      // the row commit so abandoned uploads don't leak storage cost.
      if (patch.photoUrl !== undefined) {
        dbPatch.photo_url = patch.photoUrl || "";
        if (patch.photoUrl) {
          dbPatch.photo_uploaded_by = user.id;
          dbPatch.photo_uploaded_at = new Date().toISOString();
        } else {
          dbPatch.photo_uploaded_by = null;
          dbPatch.photo_uploaded_at = null;
        }
      }
      try {
        const { error } = await supabase.from("grocery_items").update(dbPatch).eq("id", id);
        if (error) throw error;
        if (patch.photoUrl !== undefined && patch.previousPhotoUrl && patch.previousPhotoUrl !== patch.photoUrl) {
          const oldPath = groceryPhotoPath(patch.previousPhotoUrl);
          if (oldPath) {
            supabase.storage.from("grocery-photos").remove([oldPath]).then(({ error: cleanupError }) => {
              if (cleanupError) console.warn("Could not remove old grocery photo.", cleanupError);
            });
          }
        }
      } catch { /* realtime will re-sync */ }
    }
  };
  // Best-effort delete of a grocery photo's underlying storage object.
  // Fire-and-forget: storage failures WARN rather than throw because the
  // row is already gone in the user's eye, and we don't want a stale
  // photo in `grocery-photos` to keep failing the row delete call.
  const cleanupGroceryPhoto = (publicUrl) => {
    if (!remote || !publicUrl) return;
    const path = groceryPhotoPath(publicUrl);
    if (!path) return;
    supabase.storage.from("grocery-photos").remove([path]).then(({ error }) => {
      if (error) console.warn("Could not remove grocery photo from storage.", error);
    });
  };
  // Capture the photo URL(s) before clearing rows so the storage backend
  // can clean up the orphaned objects in the same gesture. Without this,
  // `clearGroceries` leaves every photo behind for the household budget
  // to silently accumulate.
  const collectPhotoPaths = (predicate) => groceries.filter(predicate).map((g) => groceryPhotoPath(g.photoUrl)).filter(Boolean);
  const removeGrocery = async (id) => {
    const previousItem = groceries.find((g) => g.id === id);
    // Optimistic: remove from local state immediately.
    setGroceries((prev) => prev.filter((g) => g.id !== id));
    if (remote) {
      try {
        const { error } = await supabase.from("grocery_items").delete().eq("id", id);
        if (error) throw error;
        if (previousItem?.photoUrl) cleanupGroceryPhoto(previousItem.photoUrl);
      } catch { /* realtime will re-sync */ }
    }
  };
  const clearCheckedGroceries = async (listId = null) => {
    const snapshot = groceries;
    const matchesList = (g) => !listId || g.listId === listId;
    const orphanPaths = collectPhotoPaths((g) => g.checked && matchesList(g));
    // Optimistic: remove checked items instantly.
    setGroceries((prev) => prev.filter((g) => !(g.checked && matchesList(g))));
    if (remote) {
      try {
        let query = supabase.from("grocery_items").delete().eq("household_id", household.id).eq("is_checked", true);
        if (listId) query = query.eq("list_id", listId);
        const { error } = await query;
        if (error) throw error;
        if (orphanPaths.length) {
          supabase.storage.from("grocery-photos").remove(orphanPaths).then(({ error }) => {
            if (error) console.warn("Could not remove some cleared grocery photos.", error);
          });
        }
      } catch (error) { setGroceries(snapshot); setDataError(error.message); throw error; }
    }
  };
  const clearGroceries = async (listId = null) => {
    const snapshot = groceries;
    const matchesList = (g) => !listId || g.listId === listId;
    const orphanPaths = collectPhotoPaths(matchesList);
    // Optimistic: clear instantly.
    setGroceries((current) => listId ? current.filter((item) => item.listId !== listId) : []);
    if (remote) {
      try {
        let query = supabase.from("grocery_items").delete().eq("household_id", household.id);
        if (listId) query = query.eq("list_id", listId);
        const { error } = await query;
        if (error) throw error;
        if (orphanPaths.length) {
          supabase.storage.from("grocery-photos").remove(orphanPaths).then(({ error }) => {
            if (error) console.warn("Could not remove grocery photos on clear-all.", error);
          });
        }
      } catch (error) { setGroceries(snapshot); setDataError(error.message); throw error; }
    }
  };

  // ---- Meals ----
  const setMealForSlot = async (date, slot, patch) => {
    const tempId = makeId("meal");
    // Optimistic: show the meal instantly.
    setMeals((prev) => {
      const existing = prev.find((m) => m.date === date && m.slot === slot);
      if (existing) return prev.map((m) => (m.id === existing.id ? { ...m, ...patch, date, slot } : m));
      return [...prev, { id: tempId, date, slot, title: "", notes: "", cookIds: [], ...patch }];
    });
    if (remote) {
      try {
        const { data, error } = await supabase.from("meals").upsert({ household_id: household.id, meal_date: date, slot, title: patch.title || "", notes: patch.notes || "", cook_ids: patch.cookIds || [], created_by: user.id }, { onConflict: "household_id,meal_date,slot" }).select().single();
        if (error) throw error;
        setMeals((prev) => prev.map((m) => (m.date === date && m.slot === slot) ? mapMeal(data) : m));
        sendHouseholdPush({ title: patch.cookIds?.length ? "Meal assigned" : "Meal plan updated", body: `${patch.title || "Meal"} · ${date} ${slot}`, tag: `meal-${data.id}`, url: "/#meals" }, patch.cookIds || []);
      } catch (error) {
        setMeals((prev) => prev.filter((m) => m.id !== tempId));
        setDataError(error.message);
        throw error;
      }
    }
  };
  const removeMeal = async (id) => {
    // Optimistic: remove from local state immediately.
    setMeals((prev) => prev.filter((m) => m.id !== id));
    if (remote) {
      try { const { error } = await supabase.from("meals").delete().eq("id", id); if (error) throw error; }
      catch { /* realtime will re-sync */ }
    }
  };
  const clearMeals = async () => {
    const snapshot = meals;
    // Optimistic: clear instantly.
    setMeals([]);
    if (remote) {
      const { error } = await supabase.from("meals").delete().eq("household_id", household.id);
      if (error) { setMeals(snapshot); setDataError(error.message); throw error; }
    }
  };

  // ---- Events ----
  const addEvent = async (event) => {
    const tempId = makeId("evt");
    // Optimistic: show the event instantly.
    setEvents((prev) => [...prev, { id: tempId, source: "local", ...event }]);
    if (remote) {
      try {
        const { data, error } = await supabase.from("events").insert({ household_id: household.id, title: event.title, starts_at: event.start, ends_at: event.end, location: event.location || "", recurrence: event.recurrence || "none", recurrence_until: event.recurrenceUntil || null, created_by: user.id }).select().single();
        if (error) throw error;
        if (event.memberIds?.length) await supabase.from("event_participants").insert(event.memberIds.map((userId) => ({ event_id: data.id, user_id: userId })));
        // Replace optimistic item with server-confirmed data.
        setEvents((prev) => prev.map((item) => item.id === tempId ? { ...mapEvent(data), memberIds: event.memberIds || [] } : item));
        sendHouseholdPush({ title: "Family calendar updated", body: event.title, tag: `event-${data.id}`, url: "/#calendar" }, event.memberIds || []);
      } catch (error) {
        setEvents((prev) => prev.filter((item) => item.id !== tempId));
        setDataError(error.message);
        throw error;
      }
    }
  };
  const updateEvent = async (id, patch) => {
    // Optimistic: update local state immediately.
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    if (remote) {
      try { const { error } = await supabase.from("events").update({ title: patch.title, starts_at: patch.start, ends_at: patch.end, location: patch.location, recurrence: patch.recurrence || "none", recurrence_until: patch.recurrenceUntil || null }).eq("id", id); if (error) throw error; }
      catch { /* realtime will re-sync */ }
    }
  };
  const removeEvent = async (id) => {
    // Optimistic: remove from local state immediately.
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (remote) {
      try { const { error } = await supabase.from("events").delete().eq("id", id); if (error) throw error; }
      catch { /* realtime will re-sync */ }
    }
  };
  const clearEvents = async () => {
    const snapshot = events;
    // Optimistic: clear instantly.
    setEvents([]);
    if (remote) {
      const { error } = await supabase.from("events").delete().eq("household_id", household.id);
      if (error) { setEvents(snapshot); setDataError(error.message); throw error; }
    }
  };

  // ---- Chat ----
  const sendMessage = async (message) => {
    // Pre-allocate a real UUID so the optimistic row's id matches the row
    // Supabase returns. applyChange() uses an `id` collision to dedupe
    // INSERT vs UPDATE, so a shared id keeps the optimistic message in
    // place when the realtime event lands a few ms later — no flicker,
    // no duplicate. Falls back to makeId() on browsers without crypto.
    const optimisticId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : makeId("msg");
    const optimisticRow = {
      id: optimisticId,
      senderId: currentUserId,
      recipientId: message.recipientId || null,
      text: message.text,
      sentAt: new Date().toISOString(),
      source: "famos",
      sourceSender: "",
      broadcast: false,
    };
    // Optimistic: show the message instantly.
    setMessages((prev) => [...prev, optimisticRow]);
    if (remote) {
      try {
        const row = { id: optimisticId, household_id: household.id, sender_id: user.id, recipient_id: message.recipientId, body: message.text };
        let result = await supabase.from("messages").insert(row).select().single();
        if (result.error && /recipient_id|schema cache/i.test(result.error.message || "")) {
          // Fallback for pre-migration schemas: drop the generated id so
          // Supabase allocates its own. The temp id in state won't match
          // the realtime payload, so applyChange() will see it as a fresh
          // INSERT — still safe, just a tiny render flicker on legacy DBs.
          const { id: _id, ...withoutId } = row;
          result = await supabase.from("messages").insert(withoutId).select().single();
        }
        if (result.error) throw result.error;
        // Reconcile: if the server assigned a different id (legacy fallback),
        // swap the optimistic row for the real one. Otherwise applyChange()
        // will dedupe via the matching id.
        if (result.data.id !== optimisticId) {
          setMessages((prev) => prev.map((item) => item.id === optimisticId ? { ...mapMessage(result.data), recipientId: result.data.recipient_id || message.recipientId || null } : item));
        }
        sendHouseholdPush({ title: `${memberById[user.id]?.name || "A family member"} sent a message`, body: message.text, tag: `message-${result.data.id}`, url: "/#chat" }, message.recipientId ? [message.recipientId] : []);
      } catch (error) {
        setMessages((prev) => prev.filter((item) => item.id !== optimisticId));
        setDataError(error.message);
        throw error;
      }
    }
  };
  const importMessages = async (items, recipientId = null) => {
    const safeItems = items
      .filter((item) => item?.text?.trim())
      .slice(0, 500)
      .map((item) => ({
        text: item.text.trim().slice(0, 4000),
        sourceSender: (item.sender || "WhatsApp").trim().slice(0, 120),
        sentAt: item.sentAt || new Date().toISOString(),
      }));
    if (!safeItems.length) return 0;
    if (remote) {
      const rows = safeItems.map((item) => ({
        household_id: household.id,
        sender_id: user.id,
        recipient_id: recipientId,
        body: item.text,
        source: "whatsapp",
        source_sender: item.sourceSender,
        created_at: item.sentAt,
      }));
      let result = await supabase.from("messages").insert(rows).select();
      if (result.error && /source|source_sender|schema cache|column/i.test(result.error.message || "")) {
        result = await supabase.from("messages").insert(rows.map((row) => {
          const { source: _source, source_sender: sourceSender, ...compatible } = row;
          return { ...compatible, body: `[WhatsApp · ${sourceSender}] ${row.body}` };
        })).select();
      }
      if (result.error) throw result.error;
      setMessages((prev) => [...prev, ...result.data.map(mapMessage)]);
      return result.data.length;
    }
    const imported = safeItems.map((item) => ({ id: makeId("msg"), senderId: user?.id || members[0]?.id, recipientId, text: item.text, sentAt: item.sentAt, source: "whatsapp", sourceSender: item.sourceSender }));
    setMessages((prev) => [...prev, ...imported]);
    return imported.length;
  };
  // Permanently remove the shared household thread for everyone in the home.
  const clearFamilyChat = async () => {
    const snapshot = messages;
    // Optimistic: remove all non-DM messages instantly.
    setMessages((prev) => prev.filter((message) => message.recipientId));
    if (remote) {
      try {
        const expected = snapshot.filter((message) => !message.recipientId).length;
        const { data, error } = await supabase.from("messages").delete().eq("household_id", household.id).is("recipient_id", null).select("id");
        if (error) throw error;
        if (expected > 0 && (!data || data.length === 0)) {
          throw new Error("Messages could not be cleared right now. Please try again in a moment.");
        }
      } catch (error) {
        // Rollback: restore all messages.
        setMessages(snapshot);
        setDataError(error.message);
        throw error;
      }
    }
  };
  // Permanently remove only the current user's direct-message threads.
  const clearMyDirectMessages = async (userId = user?.id) => {
    if (!userId) return;
    if (remote) {
      const expected = messages.filter((message) => message.recipientId && (message.senderId === userId || message.recipientId === userId)).length;
      const { data, error } = await supabase.from("messages").delete().eq("household_id", household.id).not("recipient_id", "is", null).or(`sender_id.eq.${userId},recipient_id.eq.${userId}`).select("id");
      if (error) { setDataError(error.message); throw error; }
      if (expected > 0 && (!data || data.length === 0)) {
        throw new Error("Messages could not be cleared right now. Please try again in a moment.");
      }
      const deleted = new Set((data || []).map((row) => row.id));
      setMessages((prev) => prev.filter((message) => !deleted.has(message.id)));
      return;
    }
    setMessages((prev) => prev.filter((message) => !message.recipientId || (message.senderId !== userId && message.recipientId !== userId)));
  };

  // ---- Chat unread tracking (per-device via a last-read timestamp) ----
  const currentUserId = user?.id || members[0]?.id;
  const CHAT_READ_BASE = "familyos:chat-last-read";
  // Start at 0 on every page load so existing household messages are unread
  // until the user explicitly opens the Chat page. The persisted timestamp is
  // only written by markChatRead() — never read on mount — so a page refresh
  // correctly treats all existing messages as unread.
  const [chatLastRead, setChatLastRead] = useState(0);
  // On mount, load the persisted read mark so messages sent after the user
  // last opened Chat still appear as unread. Delayed by a tick so synchronous
  // state initializers (including remote data load) settle first.
  useEffect(() => {
    const handle = setTimeout(() => {
      try {
        const key = user?.id ? `${CHAT_READ_BASE}:${user.id}` : CHAT_READ_BASE;
        const stored = Number(localStorage.getItem(key)) || 0;
        if (stored > 0) setChatLastRead(stored);
      } catch {}
    }, 0);
    return () => clearTimeout(handle);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const markChatRead = () => {
    const now = Date.now();
    setChatLastRead(now);
    try {
      const key = user?.id ? `${CHAT_READ_BASE}:${user.id}` : CHAT_READ_BASE;
      localStorage.setItem(key, String(now));
    } catch {}
  };
  // Unread = messages newer than last-read, not sent by me, in a thread I can see
  // (the household thread or a DM addressed to me). Computed from the full list.
  const unreadMessageCount = useMemo(() => messages.filter((message) => {
    if (!message || message.broadcast || message.senderId === currentUserId) return false;
    if (message.recipientId && message.recipientId !== currentUserId) return false;
    return new Date(message.sentAt).getTime() > chatLastRead;
  }).length, [messages, chatLastRead, currentUserId]);

  // ---- Broadcasts (recipient-only announcements pinned to the home screen) ----
  const broadcastDismissKey = `famos:dismissed-broadcasts:${currentUserId || "local"}`;
  const [dismissedBroadcastIds, setDismissedBroadcastIds] = useState([]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(broadcastDismissKey) || "[]");
      setDismissedBroadcastIds(Array.isArray(stored) ? stored : []);
    } catch { setDismissedBroadcastIds([]); }
  }, [broadcastDismissKey]);
  const broadcasts = useMemo(
    () => messages
      .filter((message) => message.broadcast && message.senderId !== currentUserId && !dismissedBroadcastIds.includes(message.id))
      .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)),
    [messages, currentUserId, dismissedBroadcastIds]
  );
  const broadcastMessage = async (text) => {
    const body = (text || "").trim();
    if (!body) return;
    const tempId = makeId("msg");
    // Keep the optimistic record available for realtime sync, but the sender's
    // own Today view intentionally filters it out.
    setMessages((prev) => [...prev, { id: tempId, senderId: currentUserId, recipientId: null, text: body, sentAt: new Date().toISOString(), broadcast: true }]);
    if (remote) {
      try {
        // `source_sender` already exists in the deployed schema. Its reserved
        // value keeps announcements distinct without requiring the newer
        // `broadcast` column to be present in Supabase's schema cache.
        const row = { household_id: household.id, sender_id: user.id, recipient_id: null, body, source: "famos", source_sender: "__famos_broadcast__" };
        const result = await supabase.from("messages").insert(row).select().single();
        if (result.error) throw result.error;
        setMessages((prev) => prev.map((item) => item.id === tempId ? mapMessage(result.data) : item));
        sendHouseholdPush({ title: `${memberById[user.id]?.name || "A family member"} broadcast a message`, body, tag: `broadcast-${result.data.id}`, url: "/#today" }, []);
      } catch (error) {
        setMessages((prev) => prev.filter((item) => item.id !== tempId));
        setDataError(error.message);
        throw error;
      }
    }
  };
  const clearBroadcast = async (id) => {
    if (!id) return;
    setDismissedBroadcastIds((current) => {
      const next = [...new Set([...current, id])].slice(-100);
      try { localStorage.setItem(broadcastDismissKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Reactions grouped by message id, so the Today banner can render counts + who-reacted.
  const reactionsByMessage = useMemo(() => {
    const grouped = {};
    for (const reaction of messageReactions) {
      (grouped[reaction.messageId] ||= []).push(reaction);
    }
    return grouped;
  }, [messageReactions]);

  // Toggle the current member's reaction on a broadcast (tap once to add, again to remove).
  const reactToBroadcast = async (messageId, reaction) => {
    if (!messageId || !BROADCAST_REACTIONS.includes(reaction)) return;
    const mine = messageReactions.find((item) => item.messageId === messageId && item.memberId === currentUserId && item.reaction === reaction);
    if (remote) {
      if (mine) {
        setMessageReactions((prev) => prev.filter((item) => item.id !== mine.id));
        const { error } = await supabase.from("message_reactions").delete().eq("id", mine.id);
        if (error) loadRemoteData();
      } else {
        const row = { message_id: messageId, household_id: household.id, member_id: user.id, reaction };
        const { data, error } = await supabase.from("message_reactions").insert(row).select().single();
        if (error) { if (!/duplicate|unique/i.test(error.message || "")) setDataError(error.message); return; }
        setMessageReactions((prev) => [...prev, mapReaction(data)]);
      }
    } else if (mine) {
      setMessageReactions((prev) => prev.filter((item) => item.id !== mine.id));
    } else {
      setMessageReactions((prev) => [...prev, { id: makeId("react"), messageId, memberId: currentUserId, reaction, createdAt: new Date().toISOString() }]);
    }
  };

  // ---- Finance ----
  const addExpense = async (expense) => {
    if (remote) {
      const baseRow = { household_id: household.id, description: expense.description, amount: expense.amount, category: expense.category, spent_on: expense.spentOn, created_by: user.id };
      const receiptRow = {
        ...baseRow,
        merchant: expense.merchant || null,
        receipt_notes: expense.receiptNotes || null,
        receipt_confidence: expense.receiptConfidence || null,
        receipt_source: expense.receiptSource || "manual",
      };
      let { data, error } = await supabase.from("expenses").insert(receiptRow).select().single();
      if (error && /merchant|receipt_|schema cache|column/i.test(error.message || "")) {
        const fallback = await supabase.from("expenses").insert(baseRow).select().single();
        data = fallback.data;
        error = fallback.error;
      }
      if (error) throw error;
      setExpenses((prev) => [{ ...mapExpense(data), merchant: expense.merchant || data.merchant || "", receiptNotes: expense.receiptNotes || data.receipt_notes || "", receiptConfidence: expense.receiptConfidence || data.receipt_confidence || null, receiptSource: expense.receiptSource || data.receipt_source || "manual" }, ...prev]);
    } else setExpenses((prev) => [{ id: makeId("expense"), createdBy: user?.id || null, ...expense }, ...prev]);
  };
  const removeExpense = async (id) => {
    // Optimistic: remove from local state immediately.
    setExpenses((prev) => prev.filter((expense) => expense.id !== id));
    if (remote) {
      try { const { error } = await supabase.from("expenses").delete().eq("id", id); if (error) throw error; }
      catch { /* realtime will re-sync */ }
    }
  };
  const setFinanceBudget = async (period, amount) => {
    const budgetField = period === "monthly" ? "monthly_budget" : "weekly_budget";
    if (remote) await runRemote(supabase.from("household_finance_settings").upsert({ household_id: household.id, [budgetField]: amount, tracking_period: period, updated_by: user.id }, { onConflict: "household_id" }));
    if (period === "monthly") setMonthlyBudgetState(Number(amount));
    else setWeeklyBudgetState(Number(amount));
    setFinancePeriodState(period);
  };
  const setFinancePeriod = async (period) => {
    if (remote) await runRemote(supabase.from("household_finance_settings").upsert({ household_id: household.id, tracking_period: period, updated_by: user.id }, { onConflict: "household_id" }));
    setFinancePeriodState(period);
  };

  const resetToDemoData = () => {
    setMembers(initialFamilyMembers);
    setEvents(initialEvents);
    setMeals(initialMeals);
    setGroceries(initialGroceries);
    setTasks(initialTasks);
    setMessages(initialMessages);
    setExpenses([]);
    setWeeklyBudgetState(0);
    setMonthlyBudgetState(0);
    setFinancePeriodState("weekly");
  };

  // ---- Google Calendar (one-way import: Google -> Family OS) ----
  const [googleClientId, setGoogleClientIdState] = useState(savedGoogle?.clientId ?? "");
  const [googleConnected, setGoogleConnected] = useState(savedGoogle?.connected ?? false);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [googleCalendars, setGoogleCalendars] = useState([]);
  const [googleCalendarAliases, setGoogleCalendarAliases] = useState(savedGoogle?.calendarAliases ?? {});
  const [selectedGoogleCalendarIds, setSelectedGoogleCalendarIds] = useState(savedGoogle?.selectedCalendarIds ?? []);
  const [sharedGoogleCalendarIds, setSharedGoogleCalendarIds] = useState(savedGoogle?.sharedCalendarIds ?? []);
  const [googleStatus, setGoogleStatus] = useState("idle"); // idle | connecting | syncing | error
  const [googleError, setGoogleError] = useState(null);
  const [googleLastSynced, setGoogleLastSynced] = useState(null);
  const [googleAccessToken, setGoogleAccessTokenState] = useState(null); // in-memory only, never persisted

  useEffect(() => {
    try {
      localStorage.setItem(GOOGLE_STORAGE_KEY, JSON.stringify({ clientId: googleClientId, connected: googleConnected, selectedCalendarIds: selectedGoogleCalendarIds, sharedCalendarIds: sharedGoogleCalendarIds, calendarAliases: googleCalendarAliases }));
    } catch (e) {
      console.warn("Could not save Google Calendar settings.", e);
    }
  }, [googleClientId, googleConnected, selectedGoogleCalendarIds, sharedGoogleCalendarIds, googleCalendarAliases]);

  const setGoogleClientId = (id) => setGoogleClientIdState(id);
  const syncSharedGoogleEvents = async (items, sharedIds, availableCalendars = googleCalendars) => {
    if (!remote) return;
    const activeIds = new Set(sharedIds);
    const calendarsToRefresh = availableCalendars.filter((calendar) => activeIds.has(calendar.id));
    for (const calendar of calendarsToRefresh) {
      const calendarEvents = items.filter((event) => event.calendarId === calendar.id);
      await supabase.from("events").delete().eq("household_id", household.id).eq("source", "google").eq("external_calendar_id", calendar.id).eq("created_by", user.id);
      if (!calendarEvents.length) continue;
      const rows = calendarEvents.map((event) => {
        const start = new Date(event.start);
        const rawEnd = new Date(event.end);
        const end = rawEnd > start ? rawEnd : new Date(start.getTime() + 60 * 60 * 1000);
        return {
          household_id: household.id,
          title: event.title,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          location: event.location || "",
          source: "google",
          external_id: event.id,
          external_calendar_id: event.calendarId,
          created_by: user.id,
        };
      });
      const { error } = await supabase.from("events").upsert(rows, { onConflict: "household_id,source,external_id" });
      if (error) throw error;
    }
    await loadRemoteData();
  };

  const syncGoogleEvents = async (accessToken, selectedIdsOverride) => {
    setGoogleStatus("syncing");
    setGoogleError(null);
    try {
      const fetchedCalendars = await fetchGoogleCalendars(accessToken);
      let calendars = fetchedCalendars;
      let sharedIds = sharedGoogleCalendarIds;
      let connectedIds = selectedIdsOverride ?? selectedGoogleCalendarIds;
      if (remote) {
        const { data: preferences } = await supabase.from("calendar_sharing_preferences").select("external_calendar_id,calendar_name,is_connected,shared_with_household").eq("user_id", user.id).eq("provider", "google");
        if (preferences?.length) {
          sharedIds = preferences.filter((preference) => preference.shared_with_household).map((preference) => preference.external_calendar_id);
          connectedIds = preferences.filter((preference) => preference.is_connected).map((preference) => preference.external_calendar_id);
          const aliases = Object.fromEntries(preferences.filter((preference) => preference.calendar_name).map((preference) => [preference.external_calendar_id, preference.calendar_name]));
          setGoogleCalendarAliases(aliases);
          calendars = fetchedCalendars.map((calendar) => ({ ...calendar, displayName: aliases[calendar.id] || calendar.summary }));
          setSharedGoogleCalendarIds(sharedIds);
          setSelectedGoogleCalendarIds(connectedIds);
        }
      }
      setGoogleCalendars(calendars);
      const requestedIds = connectedIds;
      const initialIds = calendars.filter(calendar=>calendar.selected||calendar.primary).map(calendar=>calendar.id);
      const activeIds = requestedIds.length ? requestedIds : initialIds;
      if (!requestedIds.length) setSelectedGoogleCalendarIds(activeIds);
      const items = await fetchGoogleCalendarEvents(accessToken, calendars.filter(calendar=>activeIds.includes(calendar.id)));
      setGoogleEvents(items);
      await syncSharedGoogleEvents(items, sharedIds, calendars);
      setGoogleLastSynced(new Date().toISOString());
      setGoogleStatus("idle");
    } catch (e) {
      // A 401/invalid-token means the Google access token has expired (Supabase
      // does not refresh provider tokens). Flag this distinctly so the UI offers
      // a real "Reconnect" instead of a generic error that just retries the dead
      // token and appears permanently disconnected.
      const message = e?.message || "";
      const expired = /reconnect_required|invalid[_ ]?grant|returned 401/i.test(message);
      setGoogleStatus(expired ? "expired" : "error");
      setGoogleError(expired
        ? "Google access expired. Reconnect to keep your calendar syncing."
        : (message || "Could not sync Google Calendar."));
    }
  };

  const googleStatusRef = useRef(googleStatus);
  useEffect(() => { googleStatusRef.current = googleStatus; }, [googleStatus]);

  useEffect(() => {
    if (!googleProviderToken) return;
    setGoogleAccessTokenState(googleProviderToken);
    setGoogleConnected(true);
    // Supabase's provider token is short lived and may have been restored from
    // localStorage after it expired. In configured environments the background
    // sync below always asks the durable refresh-token service for a fresh token
    // first. Keep the direct token path only for local/demo mode where that
    // service is unavailable.
    if (!configured) syncGoogleEvents(googleProviderToken);
  }, [googleProviderToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mount-time status recovery: on a fresh page load the in-memory
  // googleConnected state defaults to false even though the durable
  // google-calendar-token backend might already hold a refresh token for
  // this user (AuthContext captured it the moment of OAuth consent). Without
  // this probe, Settings + Calendar management modal keep showing "Not
  // connected" until the user taps Reconnect — the recurring "stuck
  // connecting" UX. The status action is a single SELECT by user_id; we
  // only flip React state to true when the backend says connected, and the
  // existing backgroundSync useEffect picks up the silent re-import from
  // there (it already gates on googleConnected). Fails silently so a
  // missing or broken edge function can't bounce the page to "not connected"
  // when truth is actually connected. We deliberately do NOT touch
  // googleStatus / googleLastSynced here — the upstream provider-token
  // useEffect + backgroundSync own those transitions correctly, including
  // the "expired" path when the refresh token was revoked.
  useEffect(() => {
    if (!remote || !user?.id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const status = await invokeEdgeFunction("google-calendar-token", { action: "status" });
        if (cancelled || !status?.connected) return;
        setGoogleConnected((current) => current || true);
      } catch {
        /* keep default state — the user can connect manually from Settings */
      }
    })();
    return () => { cancelled = true; };
  }, [remote, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-sync through the durable refresh-token service whenever the app returns,
  // comes back online, or has stayed open for a while. This must not depend on
  // Supabase's short-lived provider_token; that was the source of the recurring
  // one-hour "connected but expired" state.
  useEffect(() => {
    if (!remote || !googleConnected) return undefined;
    const resync = () => {
      if (document.visibilityState !== "visible") return;
      if (["syncing", "expired"].includes(googleStatusRef.current)) return;
      syncGoogleCalendarNow();
    };
    window.addEventListener("focus", resync);
    window.addEventListener("online", resync);
    document.addEventListener("visibilitychange", resync);
    const interval = window.setInterval(resync, 45 * 60 * 1000);
    return () => {
      window.removeEventListener("focus", resync);
      window.removeEventListener("online", resync);
      document.removeEventListener("visibilitychange", resync);
      window.clearInterval(interval);
    };
  }, [remote, googleConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background sync on (re)sign-in: when the user signs in on a new device or
  // an existing session re-opens, the durable refresh token already lives in
  // google-calendar-token. Mint a fresh access token from it and re-import
  // events silently so the calendar is up-to-date before the user even opens
  // the Calendar page. Skipped when the connection has lapsed (the helper
  // leaves googleStatus='expired' so Settings can surface "Reconnect").
  const backgroundSyncInFlightRef = useRef(null);
  useEffect(() => {
    if (!configured || !user?.id || !googleConnected) return undefined;
    let cancelled = false;
    const backgroundSync = async () => {
      if (cancelled) return;
      if (["syncing", "connecting"].includes(googleStatusRef.current)) return;
      try {
        if (backgroundSyncInFlightRef.current) {
          await backgroundSyncInFlightRef.current;
          return;
        }
        const run = (async () => {
          await syncGoogleCalendarNow();
        })();
        backgroundSyncInFlightRef.current = run;
        try { await run; } finally { backgroundSyncInFlightRef.current = null; }
      } catch {
        /* their own error UI takes over */
      }
    };
    // Defer so the rest of the page settles first.
    const handle = setTimeout(backgroundSync, 350);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [configured, user?.id, googleConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  const connectGoogleCalendar = async () => {
    if (configured) {
      setGoogleStatus("connecting");
      setGoogleError(null);
      try {
        const result = await signInWithGoogle();
        // Supabase sees the user already has a linked Google identity and
        // returns the cached one instead of redirecting — we must reset
        // the button state ourselves, otherwise it stays "Connecting…"
        // forever (the bug the user reported).
        if (result?.reused) {
          setGoogleConnected(true);
          setGoogleStatus("idle");
        }
      } catch (e) {
        setGoogleStatus("error");
        setGoogleError(e.message || "Could not connect to Google Calendar.");
      }
      return;
    }
    setGoogleStatus("connecting");
    setGoogleError(null);
    try {
      const { accessToken } = await requestGoogleAccessToken(googleClientId, { silent: false });
      setGoogleAccessTokenState(accessToken);
      setGoogleConnected(true);
      await syncGoogleEvents(accessToken);
    } catch (e) {
      setGoogleStatus("error");
      setGoogleError(e.message || "Could not connect to Google Calendar.");
    }
  };

  // Expired Google grants must go through a fresh consent flow. The ordinary
  // connect action intentionally reuses a healthy linked identity, so using it
  // for the reconnect button left an expired identity permanently stuck.
  const reconnectGoogleCalendar = async () => {
    if (!configured) return connectGoogleCalendar();
    setGoogleStatus("connecting");
    setGoogleError(null);
    try {
      await forceReconnectGoogle();
    } catch (e) {
      setGoogleStatus("expired");
      setGoogleError(e.message || "Could not reconnect Google Calendar.");
    }
  };

  // Mint a fresh Google access token from the durable backend (survives the
  // ~1h provider-token expiry). Returns null when the backend isn't deployed
  // or the stored refresh token needs re-consent, so callers can fall back.
  const getFreshGoogleToken = async () => {
    if (!remote) return null;
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await invokeEdgeFunction("google-calendar-token", { action: "token" });
        if (result?.access_token) return result.access_token;
      } catch (error) {
        lastError = error;
        if (/reconnect_required|invalid[_ ]?grant/i.test(error?.message || "")) throw error;
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 650));
      }
    }
    if (lastError) throw lastError;
    return null;
  };

  const syncGoogleCalendarNow = async () => {
    if (!googleConnected) return;
    try {
      const freshToken = await getFreshGoogleToken();
      if (freshToken) {
        setGoogleAccessTokenState(freshToken);
        await syncGoogleEvents(freshToken);
        return;
      }
      const token = googleAccessToken || (await requestGoogleAccessToken(googleClientId, { silent: true })).accessToken;
      setGoogleAccessTokenState(token);
      await syncGoogleEvents(token);
    } catch (refreshError) {
      if (configured) {
        // Use the cached Supabase provider_token as a fallback instead of
        // triggering a full OAuth redirect. The token lasts ~1 hour and is
        // refreshed by Supabase in the background.
        if (googleProviderToken) {
          setGoogleAccessTokenState(googleProviderToken);
          await syncGoogleEvents(googleProviderToken);
          return;
        }
        // No token available at all — surface the expired state so the user
        // can manually reconnect from Settings instead of an automatic OAuth
        // redirect on every sign-in.
        const revoked = /reconnect_required|invalid[_ ]?grant/i.test(refreshError?.message || "");
        setGoogleStatus(revoked ? "expired" : "error");
        setGoogleError(revoked
          ? "Google Calendar needs renewed permission. Reconnect once to restore syncing."
          : "Google Calendar sync is temporarily delayed. FamOS will retry automatically.");
        return;
      }
      // Non-configured (local mode): silent refresh failed — ask for consent.
      try {
        const { accessToken } = await requestGoogleAccessToken(googleClientId, { silent: false });
        setGoogleAccessTokenState(accessToken);
        await syncGoogleEvents(accessToken);
      } catch (e2) {
        setGoogleStatus("error");
        setGoogleError(e2.message || "Could not refresh Google Calendar.");
      }
    }
  };

  const addGoogleCalendarEvent = async (event) => {
    let token = googleAccessToken;
    if (!token) {
      const result = await requestGoogleAccessToken(googleClientId, { silent: false });
      token = result.accessToken;
      setGoogleAccessTokenState(token);
      setGoogleConnected(true);
    }
    const calendar = googleCalendars.find(item=>item.id===(event.calendarId||"primary")) || googleCalendars.find(item=>item.primary) || {id:"primary",summary:"Google Calendar",accessRole:"owner"};
    const created = await createGoogleCalendarEvent(token, event, calendar);
    setGoogleEvents((current) => [...current.filter((item) => item.id !== created.id), created]);
    return created;
  };

  const deleteGoogleCalendarEvent = async (event) => {
    if (!event?.calendarId) throw new Error("Cannot delete — this event is not linked to a Google Calendar.");
    const calendar = googleCalendars.find((item) => item.id === event.calendarId) || { id: event.calendarId, summary: "Google Calendar", accessRole: "owner" };
    // Only allow deletion of calendars the user can write to.
    if (!["owner", "writer"].includes(calendar.accessRole)) throw new Error("You can only delete events from calendars you own or can edit.");
    let token = googleAccessToken;
    if (!token) {
      const fresh = await getFreshGoogleToken();
      if (fresh) {
        token = fresh;
        setGoogleAccessTokenState(fresh);
      } else {
        const result = await requestGoogleAccessToken(googleClientId, { silent: false });
        token = result.accessToken;
        setGoogleAccessTokenState(token);
        setGoogleConnected(true);
      }
    }
    await deleteGoogleCalendarEventApi(token, event, calendar);
    // Remove from local state optimistically.
    setGoogleEvents((current) => current.filter((item) => item.id !== event.id));
  }

  const updateGoogleCalendarEvent = async (event) => {
    if (!event?.calendarId) throw new Error("Cannot update an event without its Google calendar.");
    const calendar = googleCalendars.find((item) => item.id === event.calendarId);
    if (!calendar || !["owner", "writer"].includes(calendar.accessRole)) throw new Error("This Google calendar is view-only.");
    let token = googleAccessToken || await getFreshGoogleToken();
    if (!token) {
      const result = await requestGoogleAccessToken(googleClientId, { silent: false });
      token = result.accessToken;
    }
    setGoogleAccessTokenState(token);
    const updated = await updateGoogleCalendarEventApi(token, event, calendar);
    const nextEvents = googleEvents.map((item) => item.id === event.id || item.googleEventId === event.googleEventId ? updated : item);
    setGoogleEvents(nextEvents);
    if (sharedGoogleCalendarIds.includes(calendar.id)) await syncSharedGoogleEvents(nextEvents, [calendar.id], googleCalendars);
    setGoogleLastSynced(new Date().toISOString());
    return updated;
  };


  const toggleGoogleCalendar = async (calendarId) => {
    const isConnected = !selectedGoogleCalendarIds.includes(calendarId);
    if (isConnected && selectedGoogleCalendarIds.length + calendarFeeds.length >= 5) {
      setGoogleError("You can connect up to 5 calendars. Remove one before adding another.");
      return;
    }
    const next = isConnected ? [...selectedGoogleCalendarIds, calendarId] : selectedGoogleCalendarIds.filter(id=>id!==calendarId);
    setSelectedGoogleCalendarIds(next);
    if (remote) {
      const calendar = googleCalendars.find((item) => item.id === calendarId);
      const { error } = await supabase.from("calendar_sharing_preferences").upsert({
        user_id: user.id,
        household_id: household.id,
        provider: "google",
        external_calendar_id: calendarId,
        calendar_name: calendar?.summary || "Google Calendar",
        is_connected: isConnected,
        shared_with_household: isConnected && sharedGoogleCalendarIds.includes(calendarId),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,provider,external_calendar_id" });
      if (error) throw error;
      if (!isConnected && sharedGoogleCalendarIds.includes(calendarId)) {
        setSharedGoogleCalendarIds((current) => current.filter((id) => id !== calendarId));
        await supabase.from("events").delete().eq("household_id", household.id).eq("source", "google").eq("external_calendar_id", calendarId).eq("created_by", user.id);
      }
    }
    if (googleAccessToken) await syncGoogleEvents(googleAccessToken, next);
  };
  const toggleGoogleCalendarSharing = async (calendarId) => {
    if (!selectedGoogleCalendarIds.includes(calendarId)) return;
    const shouldShare = !sharedGoogleCalendarIds.includes(calendarId);
    const next = shouldShare ? [...sharedGoogleCalendarIds, calendarId] : sharedGoogleCalendarIds.filter((id) => id !== calendarId);
    setSharedGoogleCalendarIds(next);
    if (remote) {
      const calendar = googleCalendars.find((item) => item.id === calendarId);
      const { error } = await supabase.from("calendar_sharing_preferences").upsert({
        user_id: user.id,
        household_id: household.id,
        provider: "google",
        external_calendar_id: calendarId,
        calendar_name: calendar?.summary || "Google Calendar",
        is_connected: selectedGoogleCalendarIds.includes(calendarId),
        shared_with_household: shouldShare,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,provider,external_calendar_id" });
      if (error) throw error;
      if (!shouldShare) {
        await supabase.from("events").delete().eq("household_id", household.id).eq("source", "google").eq("external_calendar_id", calendarId).eq("created_by", user.id);
        await loadRemoteData();
      }
    }
    if (shouldShare && googleAccessToken) {
      const matching = googleEvents.filter((event) => event.calendarId === calendarId);
      await syncSharedGoogleEvents(matching, [calendarId], googleCalendars);
    }
  };
  const renameGoogleCalendar = async (calendarId, name) => {
    const calendar = googleCalendars.find((item) => item.id === calendarId);
    if (!calendar) return;
    const alias = String(name || "").trim().slice(0, 80) || calendar.summary;
    setGoogleCalendarAliases((current) => ({ ...current, [calendarId]: alias }));
    setGoogleCalendars((current) => current.map((item) => item.id === calendarId ? { ...item, displayName: alias } : item));
    if (!remote) return;
    const { error } = await supabase.from("calendar_sharing_preferences").upsert({
      user_id: user.id,
      household_id: household.id,
      provider: "google",
      external_calendar_id: calendarId,
      calendar_name: alias,
      is_connected: selectedGoogleCalendarIds.includes(calendarId),
      shared_with_household: sharedGoogleCalendarIds.includes(calendarId),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider,external_calendar_id" });
    if (error) throw error;
  };

  const disconnectGoogleCalendar = () => {
    if (googleAccessToken) revokeGoogleAccessToken(googleAccessToken);
    setGoogleAccessTokenState(null);
    setGoogleConnected(false);
    setGoogleEvents([]);
    setGoogleCalendars([]);
    setSharedGoogleCalendarIds([]);
    setGoogleLastSynced(null);
    setGoogleStatus("idle");
    setGoogleError(null);
  };

  // ---- Published iCal feeds (Apple/iCloud, Outlook, and other calendar providers) ----
  const addCalendarFeed = async ({ name, provider, url }) => {
    if (selectedGoogleCalendarIds.length + calendarFeeds.length >= 5) {
      const message = "You can connect up to 5 calendars. Remove one before adding another.";
      setCalendarFeedError(message);
      throw new Error(message);
    }
    const feed = {
      id: makeId("feed"),
      name: name.trim() || (provider === "google" ? "Additional Google Calendar" : provider === "apple" ? "Apple Calendar" : provider === "outlook" ? "Outlook" : provider === "school" ? "School Calendar" : provider === "sports" ? "Sports Calendar" : "iCal"),
      provider,
      url: url.trim(),
      color: provider === "google" ? "#34A853" : provider === "outlook" ? "#1473E6" : provider === "school" ? "#E46B2C" : provider === "sports" ? "#16806A" : provider === "apple" ? "#7C5CE5" : "#D45C94",
      lastSynced: null,
      sharedWithHousehold: false,
    };
    setCalendarFeedStatus("syncing");
    setCalendarFeedError(null);
    try {
      const items = await fetchIcalFeed(feed);
      const syncedFeed = { ...feed, lastSynced: new Date().toISOString() };
      setCalendarFeeds((prev) => [...prev, syncedFeed]);
      setFeedEvents((prev) => [...prev, ...items]);
      setCalendarFeedStatus("idle");
      return syncedFeed;
    } catch (e) {
      setCalendarFeedStatus("error");
      setCalendarFeedError(e.message || "Could not sync this calendar feed.");
      throw e;
    }
  };

  const importCalendarFile = async ({ name, provider, fileName, text }) => {
    if (selectedGoogleCalendarIds.length + calendarFeeds.length >= 5) {
      const message = "You can connect up to 5 calendars. Remove one before adding another.";
      setCalendarFeedError(message);
      throw new Error(message);
    }
    const feed = {
      id: makeId("feed"),
      name: name.trim() || fileName?.replace(/\.ics$/i, "") || (provider === "outlook" ? "Outlook Calendar" : "Imported Calendar"),
      provider,
      url: "",
      source: "file",
      fileName,
      color: provider === "outlook" ? "#1473E6" : provider === "apple" ? "#7C5CE5" : "#D45C94",
      lastSynced: new Date().toISOString(),
      sharedWithHousehold: false,
    };
    if (!/BEGIN:VCALENDAR/i.test(text)) {
      const message = "Choose a valid .ics calendar export file.";
      setCalendarFeedError(message);
      throw new Error(message);
    }
    const items = parseIcalEvents(text, feed);
    setCalendarFeeds((prev) => [...prev, feed]);
    setFeedEvents((prev) => [...prev, ...items]);
    setCalendarFeedError(null);
    return feed;
  };

  const syncCalendarFeed = async (id) => {
    const feed = calendarFeeds.find((item) => item.id === id);
    if (!feed) return;
    setCalendarFeedStatus("syncing");
    setCalendarFeedError(null);
    try {
      const items = await fetchIcalFeed(feed);
      setFeedEvents((prev) => [...prev.filter((event) => event.sourceFeedId !== id), ...items]);
      setCalendarFeeds((prev) => prev.map((item) => item.id === id ? { ...item, lastSynced: new Date().toISOString() } : item));
      setCalendarFeedStatus("idle");
    } catch (e) {
      setCalendarFeedStatus("error");
      setCalendarFeedError(e.message || "Could not sync this calendar feed.");
    }
  };

  const removeCalendarFeed = (id) => {
    setCalendarFeeds((prev) => prev.filter((feed) => feed.id !== id));
    setFeedEvents((prev) => prev.filter((event) => event.sourceFeedId !== id));
    setCalendarFeedError(null);
  };

  const toggleCalendarFeedSharing = (id) => {
    setCalendarFeeds((prev) => prev.map((feed) => feed.id === id
      ? { ...feed, sharedWithHousehold: !feed.sharedWithHousehold }
      : feed));
  };

  const calendarFeedConnectionKey = calendarFeeds.map((feed) => `${feed.id}:${feed.url}`).join("|");
  useEffect(() => {
    if (!calendarFeedConnectionKey) return undefined;

    const refreshFeeds = () => {
      const now = Date.now();
      calendarFeeds
        .filter((feed) => feed.source !== "file" && (!feed.lastSynced || now - new Date(feed.lastSynced).getTime() >= 15 * 60 * 1000))
        .forEach((feed) => { syncCalendarFeed(feed.id); });
    };
    const refreshOnForeground = () => {
      if (document.visibilityState === "visible") refreshFeeds();
    };

    refreshFeeds();
    const timer = window.setInterval(refreshFeeds, 15 * 60 * 1000);
    document.addEventListener("visibilitychange", refreshOnForeground);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshOnForeground);
    };
  }, [calendarFeedConnectionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleTasks = useMemo(
    () => tabletMode ? tasks.filter((task) => task.taskType !== "personal") : tasks,
    [tabletMode, tasks],
  );
  const visibleMessages = useMemo(
    () => (tabletMode ? messages.filter((message) => !message.recipientId) : messages)
      .filter((message) => !message.broadcast),
    [tabletMode, messages],
  );

  const value = {
    tabletMode,
    members, memberById, addMember, updateMember, removeMember,
    events, addEvent, updateEvent, removeEvent, clearEvents,
    meals, setMealForSlot, removeMeal, clearMeals,
    groceries, groceryLists, addGroceryList, removeGroceryList, addGrocery, toggleGrocery, updateGrocery, removeGrocery, clearCheckedGroceries, clearGroceries,
    tasks: visibleTasks, taskLists, addTaskList, addTask, toggleTask, updateTask, removeTask, clearTasks,
    messages: visibleMessages, sendMessage, importMessages, clearFamilyChat, clearMyDirectMessages,
    unreadMessageCount, markChatRead, broadcasts, broadcastMessage, clearBroadcast, reactionsByMessage, reactToBroadcast, currentUserId,
    expenses, weeklyBudget, monthlyBudget, financePeriod, addExpense, removeExpense, setFinanceBudget, setFinancePeriod,
    resetToDemoData,
    dataLoading, dataError, refreshData: loadRemoteData,
    notificationPermission, requestNotifications, sendTestNotification,
    // Google Calendar
    googleClientId, setGoogleClientId,
    googleConnected, googleEvents: tabletMode ? [] : googleEvents, googleCalendars: tabletMode ? [] : googleCalendars, googleCalendarAliases, selectedGoogleCalendarIds, sharedGoogleCalendarIds, googleStatus, googleError, googleLastSynced,
    googleUsesAccount: configured,
    connectGoogleCalendar, reconnectGoogleCalendar, syncGoogleCalendarNow, disconnectGoogleCalendar, addGoogleCalendarEvent, updateGoogleCalendarEvent, deleteGoogleCalendarEvent, toggleGoogleCalendar, toggleGoogleCalendarSharing, renameGoogleCalendar,
    // Other calendar providers via published iCal feeds
    calendarFeeds: tabletMode ? [] : calendarFeeds, feedEvents: tabletMode ? [] : feedEvents, calendarFeedStatus, calendarFeedError,
    addCalendarFeed, importCalendarFile, syncCalendarFeed, removeCalendarFeed, toggleCalendarFeedSharing,
  };

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used within a FamilyProvider");
  return ctx;
}
