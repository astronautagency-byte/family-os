import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  initialFamilyMembers,
  initialEvents,
  initialMeals,
  initialGroceries,
  initialTasks,
  initialMessages,
} from "../data/mockData";
import { fetchGoogleCalendarEvents, requestGoogleAccessToken, revokeGoogleAccessToken } from "../lib/googleCalendar";
import { useAuth } from "./AuthContext";
import { supabase } from "../lib/supabase";

const STORAGE_KEY = "family-os:v1";
const GOOGLE_STORAGE_KEY = "family-os:google:v1";

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

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const FamilyContext = createContext(null);

export function FamilyProvider({ children }) {
  const { configured, household, user, googleProviderToken, signInWithGoogle } = useAuth();
  const remote = Boolean(configured && household?.id && user?.id && supabase);
  const saved = loadState();
  const savedGoogle = loadGoogleState();

  const [members, setMembers] = useState(saved?.members ?? initialFamilyMembers);
  const [events, setEvents] = useState(saved?.events ?? initialEvents);
  const [meals, setMeals] = useState(saved?.meals ?? initialMeals);
  const [groceries, setGroceries] = useState(saved?.groceries ?? initialGroceries);
  const [tasks, setTasks] = useState(saved?.tasks ?? initialTasks);
  const [messages, setMessages] = useState(saved?.messages ?? initialMessages);
  const [dataLoading, setDataLoading] = useState(remote);
  const [dataError, setDataError] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return "unsupported";
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    return permission;
  };

  const showTaskNotification = async (row) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const options = { body: row.due_date ? `Due ${row.due_date}` : "A new task was assigned to you.", icon: "/icons/icon-192.png", tag: `task-${row.id}` };
    const registration = await navigator.serviceWorker?.ready.catch(() => null);
    if (registration) registration.showNotification(`New task: ${row.title}`, options);
    else new Notification(`New task: ${row.title}`, options);
  };

  useEffect(() => {
    if (remote) return;
    const payload = JSON.stringify({ members, events, meals, groceries, tasks, messages });
    try {
      localStorage.setItem(STORAGE_KEY, payload);
    } catch (e) {
      console.warn("Could not save Family OS data locally.", e);
    }
  }, [members, events, meals, groceries, tasks, messages, remote]);

  const mapProfile = (row) => ({ id: row.id, name: row.display_name || row.email, role: "Partner", color: row.color, initials: row.initials });
  const mapTask = (row) => ({ id: row.id, title: row.title, assigneeId: row.assignee_id, due: row.due_date, done: row.is_done, recurring: row.recurrence });
  const mapGrocery = (row) => ({ id: row.id, name: row.name, category: row.category, quantity: Number(row.quantity), unit: row.unit, checked: row.is_checked, addedBy: row.added_by });
  const mapEvent = (row) => ({ id: row.id, title: row.title, start: row.starts_at, end: row.ends_at, location: row.location, source: row.source === "familyos" ? "local" : row.source, memberIds: (row.event_participants || []).map((p) => p.user_id) });
  const mapMeal = (row) => ({ id: row.id, date: row.meal_date, slot: row.slot, title: row.title, notes: row.notes, cookIds: row.cook_ids || [] });
  const mapMessage = (row) => ({ id: row.id, senderId: row.sender_id, text: row.body, sentAt: row.created_at });

  const loadRemoteData = async () => {
    if (!remote) return;
    setDataLoading(true); setDataError(null);
    try {
      const [membersResult, tasksResult, groceriesResult, eventsResult, mealsResult, messagesResult] = await Promise.all([
        supabase.from("household_members").select("profiles(*)").eq("household_id", household.id),
        supabase.from("tasks").select("*").eq("household_id", household.id).order("created_at"),
        supabase.from("grocery_items").select("*").eq("household_id", household.id).order("created_at"),
        supabase.from("events").select("*, event_participants(user_id)").eq("household_id", household.id).order("starts_at"),
        supabase.from("meals").select("*").eq("household_id", household.id).order("meal_date"),
        supabase.from("messages").select("*").eq("household_id", household.id).order("created_at"),
      ]);
      const failed = [membersResult, tasksResult, groceriesResult, eventsResult, mealsResult, messagesResult].find((result) => result.error);
      if (failed) throw failed.error;
      setMembers(membersResult.data.map((item) => mapProfile(item.profiles)));
      setTasks(tasksResult.data.map(mapTask)); setGroceries(groceriesResult.data.map(mapGrocery));
      setEvents(eventsResult.data.map(mapEvent)); setMeals(mealsResult.data.map(mapMeal)); setMessages(messagesResult.data.map(mapMessage));
    } catch (e) { setDataError(e.message || "Could not load household data."); }
    finally { setDataLoading(false); }
  };

  useEffect(() => { loadRemoteData(); }, [remote, household?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!remote) return undefined;
    const channel = supabase.channel(`household:${household.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `household_id=eq.${household.id}` }, loadRemoteData)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks", filter: `household_id=eq.${household.id}` }, (payload) => { if (payload.new?.assignee_id === user.id && payload.new?.created_by !== user.id) showTaskNotification(payload.new); })
      .on("postgres_changes", { event: "*", schema: "public", table: "grocery_items", filter: `household_id=eq.${household.id}` }, loadRemoteData)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `household_id=eq.${household.id}` }, loadRemoteData)
      .on("postgres_changes", { event: "*", schema: "public", table: "meals", filter: `household_id=eq.${household.id}` }, loadRemoteData)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `household_id=eq.${household.id}` }, loadRemoteData)
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
    if (remote) await runRemote(supabase.from("profiles").update({ display_name: patch.name, color: patch.color, initials: patch.initials }).eq("id", id));
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };
  const removeMember = (id) =>
    setMembers((prev) => prev.filter((m) => m.id !== id));

  // ---- Tasks ----
  const toggleTask = async (id) => { const task = tasks.find((item) => item.id === id); if (remote) await runRemote(supabase.from("tasks").update({ is_done: !task.done }).eq("id", id)); setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))); };
  const addTask = async (task) => { if (remote) { const { data, error } = await supabase.from("tasks").insert({ household_id: household.id, title: task.title, assignee_id: task.assigneeId || null, due_date: task.due || null, recurrence: task.recurring || "", created_by: user.id }).select().single(); if (error) throw error; setTasks((prev) => [...prev, mapTask(data)]); } else setTasks((prev) => [...prev, { id: makeId("task"), done: false, ...task }]); };
  const updateTask = async (id, patch) => {
    if (remote) await runRemote(supabase.from("tasks").update({ title: patch.title, assignee_id: patch.assigneeId, due_date: patch.due, is_done: patch.done, recurrence: patch.recurring }).eq("id", id));
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };
  const removeTask = async (id) => { if (remote) await runRemote(supabase.from("tasks").delete().eq("id", id)); setTasks((prev) => prev.filter((t) => t.id !== id)); };

  // ---- Groceries ----
  const toggleGrocery = async (id) => { const item = groceries.find((g) => g.id === id); if (remote) await runRemote(supabase.from("grocery_items").update({ is_checked: !item.checked }).eq("id", id)); setGroceries((prev) => prev.map((g) => (g.id === id ? { ...g, checked: !g.checked } : g))); };
  const addGrocery = async (item) => { if (remote) { const { data, error } = await supabase.from("grocery_items").insert({ household_id: household.id, name: item.name, category: item.category, quantity: item.quantity || 1, unit: item.unit || "", added_by: user.id }).select().single(); if (error) throw error; setGroceries((prev) => [...prev, mapGrocery(data)]); } else setGroceries((prev) => [...prev, { id: makeId("gro"), checked: false, quantity: 1, unit: "", ...item }]); };
  const updateGrocery = async (id, patch) => {
    if (remote) await runRemote(supabase.from("grocery_items").update({ name: patch.name, category: patch.category, quantity: patch.quantity, unit: patch.unit, is_checked: patch.checked }).eq("id", id));
    setGroceries((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };
  const removeGrocery = async (id) => { if (remote) await runRemote(supabase.from("grocery_items").delete().eq("id", id)); setGroceries((prev) => prev.filter((g) => g.id !== id)); };
  const clearCheckedGroceries = async () => { if (remote) await runRemote(supabase.from("grocery_items").delete().eq("household_id", household.id).eq("is_checked", true)); setGroceries((prev) => prev.filter((g) => !g.checked)); };

  // ---- Meals ----
  const setMealForSlot = async (date, slot, patch) => {
    if (remote) { const { data, error } = await supabase.from("meals").upsert({ household_id: household.id, meal_date: date, slot, title: patch.title || "", notes: patch.notes || "", cook_ids: patch.cookIds || [] }, { onConflict: "household_id,meal_date,slot" }).select().single(); if (error) throw error; setMeals((prev) => [...prev.filter((m) => !(m.date === date && m.slot === slot)), mapMeal(data)]); return; }
    setMeals((prev) => {
      const existing = prev.find((m) => m.date === date && m.slot === slot);
      if (existing) {
        return prev.map((m) => (m.id === existing.id ? { ...m, ...patch } : m));
      }
      return [...prev, { id: makeId("meal"), date, slot, title: "", notes: "", cookIds: [], ...patch }];
    });
  };
  const removeMeal = async (id) => { if (remote) await runRemote(supabase.from("meals").delete().eq("id", id)); setMeals((prev) => prev.filter((m) => m.id !== id)); };

  // ---- Events ----
  const addEvent = async (event) => { if (remote) { const { data, error } = await supabase.from("events").insert({ household_id: household.id, title: event.title, starts_at: event.start, ends_at: event.end, location: event.location || "", created_by: user.id }).select().single(); if (error) throw error; if (event.memberIds?.length) await runRemote(supabase.from("event_participants").insert(event.memberIds.map((userId) => ({ event_id: data.id, user_id: userId })))); setEvents((prev) => [...prev, { ...mapEvent(data), memberIds: event.memberIds || [] }]); } else setEvents((prev) => [...prev, { id: makeId("evt"), source: "local", ...event }]); };
  const updateEvent = async (id, patch) => { if (remote) await runRemote(supabase.from("events").update({ title: patch.title, starts_at: patch.start, ends_at: patch.end, location: patch.location }).eq("id", id)); setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e))); };
  const removeEvent = async (id) => { if (remote) await runRemote(supabase.from("events").delete().eq("id", id)); setEvents((prev) => prev.filter((e) => e.id !== id)); };

  // ---- Chat ----
  const sendMessage = async (message) => { if (remote) { const { data, error } = await supabase.from("messages").insert({ household_id: household.id, sender_id: user.id, body: message.text }).select().single(); if (error) throw error; setMessages((prev) => [...prev, mapMessage(data)]); } else setMessages((prev) => [...prev, { id: makeId("msg"), sentAt: new Date().toISOString(), ...message }]); };

  const resetToDemoData = () => {
    setMembers(initialFamilyMembers);
    setEvents(initialEvents);
    setMeals(initialMeals);
    setGroceries(initialGroceries);
    setTasks(initialTasks);
    setMessages(initialMessages);
  };

  // ---- Google Calendar (one-way import: Google -> Family OS) ----
  const [googleClientId, setGoogleClientIdState] = useState(savedGoogle?.clientId ?? "");
  const [googleConnected, setGoogleConnected] = useState(savedGoogle?.connected ?? false);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [googleStatus, setGoogleStatus] = useState("idle"); // idle | connecting | syncing | error
  const [googleError, setGoogleError] = useState(null);
  const [googleLastSynced, setGoogleLastSynced] = useState(null);
  const [googleAccessToken, setGoogleAccessTokenState] = useState(null); // in-memory only, never persisted

  useEffect(() => {
    try {
      localStorage.setItem(GOOGLE_STORAGE_KEY, JSON.stringify({ clientId: googleClientId, connected: googleConnected }));
    } catch (e) {
      console.warn("Could not save Google Calendar settings.", e);
    }
  }, [googleClientId, googleConnected]);

  const setGoogleClientId = (id) => setGoogleClientIdState(id);

  const syncGoogleEvents = async (accessToken) => {
    setGoogleStatus("syncing");
    setGoogleError(null);
    try {
      const items = await fetchGoogleCalendarEvents(accessToken);
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
      await signInWithGoogle();
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
    } catch (e) {
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

  const disconnectGoogleCalendar = () => {
    if (googleAccessToken) revokeGoogleAccessToken(googleAccessToken);
    setGoogleAccessTokenState(null);
    setGoogleConnected(false);
    setGoogleEvents([]);
    setGoogleLastSynced(null);
    setGoogleStatus("idle");
    setGoogleError(null);
  };

  const value = {
    members, memberById, addMember, updateMember, removeMember,
    events, addEvent, updateEvent, removeEvent,
    meals, setMealForSlot, removeMeal,
    groceries, addGrocery, toggleGrocery, updateGrocery, removeGrocery, clearCheckedGroceries,
    tasks, addTask, toggleTask, updateTask, removeTask,
    messages, sendMessage,
    resetToDemoData,
    dataLoading, dataError, refreshData: loadRemoteData,
    notificationPermission, requestNotifications,
    // Google Calendar
    googleClientId, setGoogleClientId,
    googleConnected, googleEvents, googleStatus, googleError, googleLastSynced,
    googleUsesAccount: configured,
    connectGoogleCalendar, syncGoogleCalendarNow, disconnectGoogleCalendar,
  };

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used within a FamilyProvider");
  return ctx;
}
