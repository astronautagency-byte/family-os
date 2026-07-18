import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  initialFamilyMembers,
  initialEvents,
  initialMeals,
  initialGroceries,
  initialTasks,
  initialMessages,
} from "../data/mockData";
import { createGoogleCalendarEvent, fetchGoogleCalendarEvents, fetchGoogleCalendars, requestGoogleAccessToken, revokeGoogleAccessToken } from "../lib/googleCalendar";
import { fetchIcalFeed, parseIcalEvents } from "../lib/icalCalendar";
import { useAuth } from "./AuthContext";
import { supabase } from "../lib/supabase";

const STORAGE_KEY = "family-os:v1";
const GOOGLE_STORAGE_KEY = "family-os:google:v1";
const CALENDAR_FEEDS_STORAGE_KEY = "family-os:calendar-feeds:v1";
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

export function FamilyProvider({ children }) {
  const { configured, household, user, googleProviderToken, signInWithGoogle } = useAuth();
  const remote = Boolean(configured && household?.id && user?.id && supabase);
  const saved = loadState();
  const savedGoogle = loadGoogleState();
  const savedCalendarFeeds = loadCalendarFeedState();

  const [members, setMembers] = useState(saved?.members ?? initialFamilyMembers);
  const [events, setEvents] = useState(saved?.events ?? initialEvents);
  const [meals, setMeals] = useState(saved?.meals ?? initialMeals);
  const [groceries, setGroceries] = useState(saved?.groceries ?? initialGroceries);
  const [tasks, setTasks] = useState(saved?.tasks ?? initialTasks);
  const [messages, setMessages] = useState(saved?.messages ?? initialMessages);
  const [expenses, setExpenses] = useState(saved?.expenses ?? []);
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
    const payload = JSON.stringify({ members, events, meals, groceries, tasks, messages, expenses, weeklyBudget, monthlyBudget, financePeriod });
    try {
      localStorage.setItem(STORAGE_KEY, payload);
    } catch (e) {
      console.warn("Could not save Family OS data locally.", e);
    }
  }, [members, events, meals, groceries, tasks, messages, expenses, weeklyBudget, monthlyBudget, financePeriod, remote]);

  const mapProfile = (row, membershipRole) => ({
    id: row.id,
    name: row.display_name || row.email,
    email: row.email || "",
    role: membershipRole === "owner" ? "Household owner" : "Family member",
    color: row.color,
    initials: row.initials,
    avatarUrl: loadAvatarOverrides()[row.id] || row.avatar_url || (row.id === user?.id ? user.user_metadata?.avatar_url || user.user_metadata?.picture || "" : ""),
  });
  const mapTask = (row) => ({ id: row.id, title: row.title, assigneeId: row.assignee_id, due: row.due_date, done: row.is_done, recurring: row.recurrence, taskType: row.task_type || "home" });
  const mapGrocery = (row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: Number(row.quantity),
    unit: row.unit,
    checked: row.is_checked,
    addedBy: row.added_by,
    barcode: row.barcode || "",
    brand: row.brand || "",
    price: row.price == null ? null : Number(row.price),
    imageUrl: row.image_url || "",
  });
  const mapEvent = (row) => ({ id: row.id, title: row.title, start: row.starts_at, end: row.ends_at, location: row.location, source: row.source === "familyos" ? "local" : row.source, memberIds: (row.event_participants || []).map((p) => p.user_id) });
  const mapMeal = (row) => ({ id: row.id, date: row.meal_date, slot: row.slot, title: row.title, notes: row.notes, cookIds: row.cook_ids || [] });
  const mapMessage = (row) => ({ id: row.id, senderId: row.sender_id, recipientId: row.recipient_id || null, text: row.body, sentAt: row.created_at });
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
    } catch (e) { setDataError(e.message || "Could not load household data."); }
    finally { setDataLoading(false); }
  };

  useEffect(() => { loadRemoteData(); }, [remote, household?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!remote) return undefined;
    const channel = supabase.channel(`household:${household.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `household_id=eq.${household.id}` }, (payload) => { notifyFromChange("tasks", payload); loadRemoteData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "grocery_items", filter: `household_id=eq.${household.id}` }, (payload) => { notifyFromChange("grocery_items", payload); loadRemoteData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `household_id=eq.${household.id}` }, loadRemoteData)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events", filter: `household_id=eq.${household.id}` }, (payload) => notifyFromChange("events", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "meals", filter: `household_id=eq.${household.id}` }, (payload) => { notifyFromChange("meals", payload); loadRemoteData(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `household_id=eq.${household.id}` }, (payload) => { notifyFromChange("messages", payload); loadRemoteData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `household_id=eq.${household.id}` }, loadRemoteData)
      .on("postgres_changes", { event: "*", schema: "public", table: "household_members", filter: `household_id=eq.${household.id}` }, loadRemoteData)
      .on("postgres_changes", { event: "*", schema: "public", table: "household_finance_settings", filter: `household_id=eq.${household.id}` }, loadRemoteData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [remote, household?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const toggleTask = async (id) => { const task = tasks.find((item) => item.id === id); if (remote) await runRemote(supabase.from("tasks").update({ is_done: !task.done }).eq("id", id)); setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))); };
  const addTask = async (task) => {
    if (remote) {
      const row = { household_id: household.id, title: task.title, assignee_id: task.assigneeId || null, due_date: task.due || null, recurrence: task.recurring || "", task_type: task.taskType || "home", created_by: user.id };
      let result = await supabase.from("tasks").insert(row).select().single();
      if (result.error && /task_type|schema cache/i.test(result.error.message || "")) {
        const { task_type: _taskType, ...compatibleRow } = row;
        result = await supabase.from("tasks").insert(compatibleRow).select().single();
      }
      if (result.error) throw result.error;
      setTasks((prev) => [...prev, mapTask(result.data)]);
      sendHouseholdPush({ title: "New task assigned", body: task.title, tag: `task-${result.data.id}`, url: "/#tasks" }, task.assigneeId ? [task.assigneeId] : []);
    } else setTasks((prev) => [...prev, { id: makeId("task"), done: false, taskType: "home", ...task }]);
  };
  const updateTask = async (id, patch) => {
    const dbPatch = {};
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.assigneeId !== undefined) dbPatch.assignee_id = patch.assigneeId;
    if (patch.due !== undefined) dbPatch.due_date = patch.due;
    if (patch.done !== undefined) dbPatch.is_done = patch.done;
    if (patch.recurring !== undefined) dbPatch.recurrence = patch.recurring;
    if (patch.taskType !== undefined) dbPatch.task_type = patch.taskType;
    if (remote) await runRemote(supabase.from("tasks").update(dbPatch).eq("id", id));
    if (remote && patch.assigneeId) sendHouseholdPush({ title: "Task assigned to you", body: patch.title || tasks.find((task) => task.id === id)?.title || "A household task", tag: `task-${id}`, url: "/#tasks" }, [patch.assigneeId]);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };
  const removeTask = async (id) => { if (remote) await runRemote(supabase.from("tasks").delete().eq("id", id)); setTasks((prev) => prev.filter((t) => t.id !== id)); };
  const clearTasks = async () => { if (remote) await runRemote(supabase.from("tasks").delete().eq("household_id", household.id)); setTasks([]); };

  // ---- Groceries ----
  const toggleGrocery = async (id) => { const item = groceries.find((g) => g.id === id); if (remote) await runRemote(supabase.from("grocery_items").update({ is_checked: !item.checked }).eq("id", id)); setGroceries((prev) => prev.map((g) => (g.id === id ? { ...g, checked: !g.checked } : g))); };
  const addGrocery = async (item) => {
    if (remote) {
      const row = {
        household_id: household.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity || 1,
        unit: item.unit || "",
        added_by: user.id,
        barcode: item.barcode || null,
        brand: item.brand || "",
        price: item.price ?? null,
        image_url: item.imageUrl || "",
      };
      const { data, error } = await supabase.from("grocery_items").insert(row).select().single();
      if (error) throw error;
      setGroceries((prev) => [...prev, mapGrocery(data)]);
      sendHouseholdPush({ title: "Grocery added", body: item.name, tag: `grocery-${data.id}`, url: "/#groceries" });
    } else {
      setGroceries((prev) => [...prev, { id: makeId("gro"), checked: false, quantity: 1, unit: "", ...item }]);
    }
  };
  const updateGrocery = async (id, patch) => {
    if (remote) await runRemote(supabase.from("grocery_items").update({ name: patch.name, category: patch.category, quantity: patch.quantity, unit: patch.unit, is_checked: patch.checked }).eq("id", id));
    setGroceries((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };
  const removeGrocery = async (id) => { if (remote) await runRemote(supabase.from("grocery_items").delete().eq("id", id)); setGroceries((prev) => prev.filter((g) => g.id !== id)); };
  const clearCheckedGroceries = async () => { if (remote) await runRemote(supabase.from("grocery_items").delete().eq("household_id", household.id).eq("is_checked", true)); setGroceries((prev) => prev.filter((g) => !g.checked)); };
  const clearGroceries = async () => { if (remote) await runRemote(supabase.from("grocery_items").delete().eq("household_id", household.id)); setGroceries([]); };

  // ---- Meals ----
  const setMealForSlot = async (date, slot, patch) => {
    if (remote) { const { data, error } = await supabase.from("meals").upsert({ household_id: household.id, meal_date: date, slot, title: patch.title || "", notes: patch.notes || "", cook_ids: patch.cookIds || [], created_by: user.id }, { onConflict: "household_id,meal_date,slot" }).select().single(); if (error) throw error; setMeals((prev) => [...prev.filter((m) => !(m.date === date && m.slot === slot)), mapMeal(data)]); sendHouseholdPush({ title: patch.cookIds?.length ? "Meal assigned" : "Meal plan updated", body: `${patch.title || "Meal"} · ${date} ${slot}`, tag: `meal-${data.id}`, url: "/#meals" }, patch.cookIds || []); return; }
    setMeals((prev) => {
      const existing = prev.find((m) => m.date === date && m.slot === slot);
      if (existing) {
        return prev.map((m) => (m.id === existing.id ? { ...m, ...patch } : m));
      }
      return [...prev, { id: makeId("meal"), date, slot, title: "", notes: "", cookIds: [], ...patch }];
    });
  };
  const removeMeal = async (id) => { if (remote) await runRemote(supabase.from("meals").delete().eq("id", id)); setMeals((prev) => prev.filter((m) => m.id !== id)); };
  const clearMeals = async () => { if (remote) await runRemote(supabase.from("meals").delete().eq("household_id", household.id)); setMeals([]); };

  // ---- Events ----
  const addEvent = async (event) => { if (remote) { const { data, error } = await supabase.from("events").insert({ household_id: household.id, title: event.title, starts_at: event.start, ends_at: event.end, location: event.location || "", created_by: user.id }).select().single(); if (error) throw error; if (event.memberIds?.length) await runRemote(supabase.from("event_participants").insert(event.memberIds.map((userId) => ({ event_id: data.id, user_id: userId })))); setEvents((prev) => [...prev, { ...mapEvent(data), memberIds: event.memberIds || [] }]); sendHouseholdPush({ title: "Family calendar updated", body: event.title, tag: `event-${data.id}`, url: "/#calendar" }, event.memberIds || []); } else setEvents((prev) => [...prev, { id: makeId("evt"), source: "local", ...event }]); };
  const updateEvent = async (id, patch) => { if (remote) await runRemote(supabase.from("events").update({ title: patch.title, starts_at: patch.start, ends_at: patch.end, location: patch.location }).eq("id", id)); setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e))); };
  const removeEvent = async (id) => { if (remote) await runRemote(supabase.from("events").delete().eq("id", id)); setEvents((prev) => prev.filter((e) => e.id !== id)); };
  const clearEvents = async () => { if (remote) await runRemote(supabase.from("events").delete().eq("household_id", household.id)); setEvents([]); };

  // ---- Chat ----
  const sendMessage = async (message) => {
    if (remote) {
      const row = { household_id: household.id, sender_id: user.id, recipient_id: message.recipientId, body: message.text };
      let result = await supabase.from("messages").insert(row).select().single();
      if (result.error && /recipient_id|schema cache/i.test(result.error.message || "")) {
        const { recipient_id: _recipientId, ...compatibleRow } = row;
        result = await supabase.from("messages").insert(compatibleRow).select().single();
      }
      if (result.error) throw result.error;
      setMessages((prev) => [...prev, { ...mapMessage(result.data), recipientId: result.data.recipient_id || message.recipientId || null }]);
      sendHouseholdPush({ title: `${memberById[user.id]?.name || "A family member"} sent a message`, body: message.text, tag: `message-${result.data.id}`, url: "/#chat" }, message.recipientId ? [message.recipientId] : []);
    } else setMessages((prev) => [...prev, { id: makeId("msg"), sentAt: new Date().toISOString(), ...message }]);
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
    if (remote) await runRemote(supabase.from("expenses").delete().eq("id", id));
    setExpenses((prev) => prev.filter((expense) => expense.id !== id));
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
  const [selectedGoogleCalendarIds, setSelectedGoogleCalendarIds] = useState(savedGoogle?.selectedCalendarIds ?? []);
  const [googleStatus, setGoogleStatus] = useState("idle"); // idle | connecting | syncing | error
  const [googleError, setGoogleError] = useState(null);
  const [googleLastSynced, setGoogleLastSynced] = useState(null);
  const [googleAccessToken, setGoogleAccessTokenState] = useState(null); // in-memory only, never persisted

  useEffect(() => {
    try {
      localStorage.setItem(GOOGLE_STORAGE_KEY, JSON.stringify({ clientId: googleClientId, connected: googleConnected, selectedCalendarIds: selectedGoogleCalendarIds }));
    } catch (e) {
      console.warn("Could not save Google Calendar settings.", e);
    }
  }, [googleClientId, googleConnected, selectedGoogleCalendarIds]);

  const setGoogleClientId = (id) => setGoogleClientIdState(id);

  const syncGoogleEvents = async (accessToken, selectedIdsOverride) => {
    setGoogleStatus("syncing");
    setGoogleError(null);
    try {
      const calendars = await fetchGoogleCalendars(accessToken);
      setGoogleCalendars(calendars);
      const requestedIds = selectedIdsOverride ?? selectedGoogleCalendarIds;
      const initialIds = calendars.filter(calendar=>calendar.selected||calendar.primary).map(calendar=>calendar.id);
      const activeIds = requestedIds.length ? requestedIds : initialIds;
      if (!requestedIds.length) setSelectedGoogleCalendarIds(activeIds);
      const items = await fetchGoogleCalendarEvents(accessToken, calendars.filter(calendar=>activeIds.includes(calendar.id)));
      setGoogleEvents(items);
      setGoogleLastSynced(new Date().toISOString());
      setGoogleStatus("idle");
    } catch (e) {
      setGoogleStatus("error");
      setGoogleError(e.message || "Could not sync Google Calendar.");
    }
  };

  useEffect(() => {
    if (!googleProviderToken) return;
    setGoogleAccessTokenState(googleProviderToken);
    setGoogleConnected(true);
    syncGoogleEvents(googleProviderToken);
  }, [googleProviderToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const connectGoogleCalendar = async () => {
    if (configured) {
      setGoogleStatus("connecting");
      setGoogleError(null);
      try {
        await signInWithGoogle();
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

  const syncGoogleCalendarNow = async () => {
    if (!googleConnected) return;
    try {
      const token = googleAccessToken || (await requestGoogleAccessToken(googleClientId, { silent: true })).accessToken;
      setGoogleAccessTokenState(token);
      await syncGoogleEvents(token);
    } catch {
      if (configured) {
        setGoogleStatus("connecting");
        setGoogleError(null);
        try {
          await signInWithGoogle();
        } catch (reconnectError) {
          setGoogleStatus("error");
          setGoogleError(reconnectError.message || "Could not reconnect Google Calendar.");
        }
        return;
      }
      // Silent refresh failed (likely expired / revoked) — ask for consent again.
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

  const toggleGoogleCalendar = async (calendarId) => {
    const next = selectedGoogleCalendarIds.includes(calendarId) ? selectedGoogleCalendarIds.filter(id=>id!==calendarId) : [...selectedGoogleCalendarIds,calendarId];
    setSelectedGoogleCalendarIds(next);
    if (googleAccessToken) await syncGoogleEvents(googleAccessToken, next);
  };

  const disconnectGoogleCalendar = () => {
    if (googleAccessToken) revokeGoogleAccessToken(googleAccessToken);
    setGoogleAccessTokenState(null);
    setGoogleConnected(false);
    setGoogleEvents([]);
    setGoogleCalendars([]);
    setGoogleLastSynced(null);
    setGoogleStatus("idle");
    setGoogleError(null);
  };

  // ---- Published iCal feeds (Apple/iCloud, Outlook, and other calendar providers) ----
  const addCalendarFeed = async ({ name, provider, url }) => {
    const feed = {
      id: makeId("feed"),
      name: name.trim() || (provider === "apple" ? "Apple Calendar" : provider === "outlook" ? "Outlook" : "iCal"),
      provider,
      url: url.trim(),
      color: provider === "outlook" ? "#1473E6" : provider === "apple" ? "#7C5CE5" : "#D45C94",
      lastSynced: null,
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
    const feed = {
      id: makeId("feed"),
      name: name.trim() || fileName?.replace(/\.ics$/i, "") || (provider === "outlook" ? "Outlook Calendar" : "Imported Calendar"),
      provider,
      url: "",
      source: "file",
      fileName,
      color: provider === "outlook" ? "#1473E6" : provider === "apple" ? "#7C5CE5" : "#D45C94",
      lastSynced: new Date().toISOString(),
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

  const value = {
    members, memberById, addMember, updateMember, removeMember,
    events, addEvent, updateEvent, removeEvent, clearEvents,
    meals, setMealForSlot, removeMeal, clearMeals,
    groceries, addGrocery, toggleGrocery, updateGrocery, removeGrocery, clearCheckedGroceries, clearGroceries,
    tasks, addTask, toggleTask, updateTask, removeTask, clearTasks,
    messages, sendMessage,
    expenses, weeklyBudget, monthlyBudget, financePeriod, addExpense, removeExpense, setFinanceBudget, setFinancePeriod,
    resetToDemoData,
    dataLoading, dataError, refreshData: loadRemoteData,
    notificationPermission, requestNotifications, sendTestNotification,
    // Google Calendar
    googleClientId, setGoogleClientId,
    googleConnected, googleEvents, googleCalendars, selectedGoogleCalendarIds, googleStatus, googleError, googleLastSynced,
    googleUsesAccount: configured,
    connectGoogleCalendar, syncGoogleCalendarNow, disconnectGoogleCalendar, addGoogleCalendarEvent, toggleGoogleCalendar,
    // Other calendar providers via published iCal feeds
    calendarFeeds, feedEvents, calendarFeedStatus, calendarFeedError,
    addCalendarFeed, importCalendarFile, syncCalendarFeed, removeCalendarFeed,
  };

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used within a FamilyProvider");
  return ctx;
}
