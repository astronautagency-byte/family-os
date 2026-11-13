import NextSuggestion from '../components/NextSuggestion';
import { fireConfetti } from '../lib/confetti';
import { todaySuggestions } from '../lib/todaySuggestions';
import {useHouseholdFeatures} from "../context/HouseholdFeaturesContext";
import { combineCalendarSources } from '../lib/calendarSources';
import { expandRecurringEvents } from '../lib/eventRecurrence';
import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarPlus, ChefHat, ChevronRight, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Droplets, ExternalLink, LayoutGrid, ListChecks, LoaderCircle, MapPin, MessageCircle, Moon, PartyPopper, Plus, Refrigerator, ShoppingCart, Sun, Ticket, Trash2, TriangleAlert, Wind, Sparkles } from "../components/icons";
// ChefHat is already imported above for the Cook button icon.
import { useFamily } from "../context/FamilyContext";
import { useAuth } from "../context/AuthContext";
import { Avatar, AvatarStack, Card, Checkbox, EmptyState } from "../components/ui";
import PageHeader from "../components/PageHeader";
import TodayCustomizer from "../components/TodayCustomizer";
import TodayAtAGlance from "../components/TodayAtAGlance";
import MealSlotArt from "../components/MealSlotArt";
import WeeklyPlanner from "../components/WeeklyPlanner";
import { requestPageAdd } from "../hooks/usePageAdd";
import PullToRefresh from "../components/PullToRefresh";
import { supabase } from "../lib/supabase";
import { eventDateLocal, formatTime, fullDateLabel, greetingInfo, todayISO } from "../lib/dates";
import { isAllDayEvent, eventOccursOnDate } from "../lib/calendarEventDates";
import useKitchenInventory from "../hooks/useKitchenInventory";
import { expiringInventory, inventoryExpiryStatus } from "../lib/inventoryExpiry";
import NativeAdBanner from "../components/NativeAdBanner";
import ProductUpdateBanner from "../components/ProductUpdateBanner";
import EmailInbox from "../components/EmailInbox";
import { AD_PLACEMENTS } from "../lib/adNetwork";
import { IS_APP_STORE } from "../lib/distribution";

// Map a normalised weather "kind" (+ day/night) to a lucide icon and label.
const WEATHER_KIND = {
  clear: { day: Sun, night: Moon, label: "Clear" },
  "partly-cloudy": { day: CloudSun, night: CloudMoon, label: "Partly cloudy" },
  cloudy: { day: Cloud, night: Cloud, label: "Cloudy" },
  fog: { day: CloudFog, night: CloudFog, label: "Fog" },
  drizzle: { day: CloudDrizzle, night: CloudDrizzle, label: "Drizzle" },
  rain: { day: CloudRain, night: CloudRain, label: "Rain" },
  snow: { day: CloudSnow, night: CloudSnow, label: "Snow" },
  thunder: { day: CloudLightning, night: CloudLightning, label: "Storms" },
};
const TODAY_MEAL_SLOTS = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
];
const DASHBOARD_ORDER_KEY = "famos:today-card-order:v1";
const DASHBOARD_HIDDEN_KEY = "famos:today-card-hidden:v1";
const DASHBOARD_CARDS = [
  { id: "weather", label: "Weather" },
  { id: "schedule", label: "Schedule" },
  { id: "meals", label: "Meals" },
  { id: "groceries", label: "Shopping" },
  { id: "kitchen", label: "Kitchen" },
  { id: "messages", label: "Messages" },
  { id: "tasks", label: "Tasks" },
];
const defaultDashboardOrder = ["schedule", "tasks", "meals", "groceries", "weather", "kitchen", "messages"];
const readDashboardOrder = () => {
  if (typeof window === "undefined") return defaultDashboardOrder;
  try {
    const saved = JSON.parse(window.localStorage.getItem(DASHBOARD_ORDER_KEY) || "[]");
    return saved.length === defaultDashboardOrder.length && defaultDashboardOrder.every((id) => saved.includes(id)) ? saved : defaultDashboardOrder;
  } catch { return defaultDashboardOrder; }
};
const readHiddenDashboardCards = () => {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(window.localStorage.getItem(DASHBOARD_HIDDEN_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((id) => defaultDashboardOrder.includes(id)) : [];
  } catch { return []; }
};
const weatherKind = (kind) => WEATHER_KIND[kind] || WEATHER_KIND.cloudy;
function WeatherGlyph({ kind, isDay = true, size = 20 }) {
  const meta = weatherKind(kind);
  const Icon = isDay ? meta.day : meta.night;
  return <Icon size={size} />;
}

// Open-Meteo WMO weather codes → our kind vocabulary (used only in the keyless fallback).
const wmoToKind = (code) => {
  const c = Number(code);
  if (c === 0) return "clear";
  if (c === 1 || c === 2) return "partly-cloudy";
  if (c === 3) return "cloudy";
  if (c === 45 || c === 48) return "fog";
  if (c >= 51 && c <= 57) return "drizzle";
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return "rain";
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow";
  if (c >= 95) return "thunder";
  return "cloudy";
};

const conditionLabel = (entry) => entry?.conditionText || weatherKind(entry?.kind).label;
const roundTemp = (value) => (Number.isFinite(Number(value)) ? Math.round(Number(value)) : "—");

// Event type classification (mirrors Calendar.jsx for consistent carousel badges).
const EVENT_TYPES = {
  family: { label: "Family", color: "var(--color-family)" },
  school: { label: "School", color: "var(--color-calendar)" },
  activity: { label: "Activities", color: "var(--color-shopping)" },
  health: { label: "Health", color: "var(--color-chat)" },
  work: { label: "Work", color: "var(--color-finance)" },
};
const eventType = (event) => {
  if (event.eventType && EVENT_TYPES[event.eventType]) return event.eventType;
  const text = `${event.title} ${event.location || ""}`.toLowerCase();
  if (/school|class|teacher|homework|project/.test(text)) return "school";
  if (/doctor|dentist|clinic|health|appointment/.test(text)) return "health";
  if (/practice|soccer|hockey|dance|game|gym|swim/.test(text)) return "activity";
  if (/work|meeting|client|office/.test(text)) return "work";
  return "family";
};

export default function Today({ goTo }) {
  const {sharedGoogleCalendarIds=[]}=useFamily();
  const {features,pauseReminders}=useHouseholdFeatures();
  const dashboardEnabled=id=>features[({schedule:"calendar",messages:"chat"})[id] || id]!==false;
  // ── Subscription trial state ──
  const [subscription, setSubscription] = useState(null);
  const [promoUnlocked, setPromoUnlocked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [subRes, promoRes] = await Promise.allSettled([
          supabase.rpc("get_my_subscription"),
          supabase.rpc("has_unlock_all_promo"),
        ]);
        if (!cancelled) {
          if (subRes.status === "fulfilled" && !subRes.value.error && subRes.value.data?.[0]) {
            console.log("[Today] subscription:", subRes.value.data[0]);
            setSubscription(subRes.value.data[0]);
          } else {
            console.log("[Today] no subscription data");
          }
          if (promoRes.status === "fulfilled" && !promoRes.value.error) {
            setPromoUnlocked(!!promoRes.value.data);
          }
        }
      } catch {
        if (!cancelled) { /* subscription is optional */ }
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const trialDaysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86_400_000))
    : null;
  const isTrial = (subscription?.status === "trial" || subscription?.status === "trialing") && trialDaysLeft > 0 && !promoUnlocked;
  const isExpired = subscription?.status === "canceled" || (subscription?.status === "trial" && trialDaysLeft === 0);

  const { members, memberById, events, googleEvents, feedEvents, meals, tasks, taskLists = [], groceries, messages, addGrocery, addTask, toggleTask, tabletMode, currentUserId, refreshData, syncGoogleCalendarNow, googleConnected, notificationPermission, requestNotifications } = useFamily();
  const { profile, user, household, householdProfileExtra } = useAuth();
  const goalKey = household?.id && user?.id ? `famos:first-goal:v1:${household.id}:${user.id}` : '';
  const [firstGoal, setFirstGoal] = useState('');
  useEffect(() => { try { setFirstGoal(goalKey ? localStorage.getItem(goalKey) || '' : ''); } catch { setFirstGoal(''); } }, [goalKey]);
  const clearFirstGoal = () => { try { if (goalKey) localStorage.removeItem(goalKey); } catch { /* ignore unavailable storage */ } setFirstGoal(''); };
  const inviteFromWeek = () => { try { sessionStorage.setItem('famos:settings-section', 'family'); } catch { /* settings remains available */ } goTo('settings'); };
  const { items: inventoryItems, removeItem: removeInventoryItem } = useKitchenInventory(household?.id, user?.id);
  const expiryAlerts = useMemo(() => expiringInventory(inventoryItems), [inventoryItems]);
  const [replacementIds, setReplacementIds] = useState(() => new Set());
  const [remindedIds, setRemindedIds] = useState(() => new Set());
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState("");
  const [editingDashboard, setEditingDashboard] = useState(false);
  const [dashboardOrder, setDashboardOrder] = useState(readDashboardOrder);
  const [hiddenDashboardCards, setHiddenDashboardCards] = useState(readHiddenDashboardCards);
  const [cardSizes, setCardSizes] = useState(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = JSON.parse(localStorage.getItem("famos:today-card-sizes:v1") || "{}");
      return typeof saved === "object" ? saved : {};
    } catch { return {}; }
  });

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(DASHBOARD_ORDER_KEY, JSON.stringify(dashboardOrder));
  }, [dashboardOrder]);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(DASHBOARD_HIDDEN_KEY, JSON.stringify(hiddenDashboardCards));
  }, [hiddenDashboardCards]);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("famos:today-card-sizes:v1", JSON.stringify(cardSizes));
  }, [cardSizes]);

  const dashboardPosition = (id) => {
    if(!dashboardEnabled(id))return {display:"none"};
    return { 
      order: dashboardOrder.indexOf(id) + 1, 
      display: hiddenDashboardCards.includes(id) ? "none" : undefined,
    };
  };
  const toggleDashboardCard = (id) => setHiddenDashboardCards((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const moveDashboardCard = (id, direction) => {
    setDashboardOrder((current) => {
      const enabled = current.filter(dashboardEnabled);
      const target = enabled[enabled.indexOf(id) + direction];
      if (!target) return current;
      const next = [...current];
      const from = next.indexOf(id), to = next.indexOf(target);
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };

  useEffect(() => {
    if ((pauseReminders && !features.kitchen) || !expiryAlerts.length || notificationPermission !== "granted" || typeof window === "undefined") return;
    const dateKey = todayISO();
    const reminderKey = `famos:inventory-expiry-reminder:v1:${household?.id || "local"}:${dateKey}`;
    if (window.localStorage.getItem(reminderKey)) return;
    const expiredCount = expiryAlerts.filter((item) => item.expiry.state === "expired").length;
    const title = expiredCount ? `${expiredCount} kitchen item${expiredCount === 1 ? " needs" : "s need"} replacing` : "Kitchen items to use soon";
    const body = expiryAlerts.slice(0, 3).map((item) => item.name).join(", ") + (expiryAlerts.length > 3 ? ` +${expiryAlerts.length - 3} more` : "");
    const show = async () => {
      try {
        const registration = await navigator.serviceWorker?.ready;
        if (registration) await registration.showNotification(title, { body, tag: `kitchen-expiry-${dateKey}`, icon: "/brand/famos-icon.png", data: { url: "/#today" } });
        else if (typeof Notification !== "undefined") new Notification(title, { body, icon: "/brand/famos-icon.png" });
        window.localStorage.setItem(reminderKey, "sent");
      } catch { /* the Today card remains the durable reminder */ }
    };
    show();
  }, [expiryAlerts, household?.id, notificationPermission,features.kitchen,pauseReminders]);

  const replaceInventoryItem = async (item) => {
    if (replacementIds.has(item.id) || groceries.some((grocery) => !grocery?.checked && String(grocery?.name || "").toLowerCase() === String(item?.name || "").toLowerCase())) return;
    await addGrocery({ name: item.name, quantity: 1, unit: item.unit || "" });
    setReplacementIds((current) => new Set(current).add(item.id));
  };

  // Per-item "Remind me" — asks for notification permission on first use,
  // then fires an immediate reminder for this exact item and flashes inline
  // confirmation on the card.
  const remindForItem = async (item) => {
    if (notificationPermission !== "granted") {
      const result = await requestNotifications();
      if (result !== "granted") return;
    }
    const title = `Use your ${item.name}`;
    const body = item.expiry?.label ? `${item.expiry.label} · ${item.location || "kitchen"}` : `It's time to use or replace your ${item.name}.`;
    try {
      const registration = await navigator.serviceWorker?.ready;
      if (registration) await registration.showNotification(title, { body, tag: `kitchen-item-${item.id}`, icon: "/brand/famos-icon.png", data: { url: "/#today" } });
      else if (typeof Notification !== "undefined") new Notification(title, { body, icon: "/brand/famos-icon.png" });
    } catch { /* inline confirmation below still acknowledges the tap */ }
    setRemindedIds((current) => new Set(current).add(item.id));
    window.setTimeout(() => setRemindedIds((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    }), 2000);
  };

  const WEATHER_CACHE_KEY = "famos:weather-cache:v1";
  const loadWeatherCache = () => {
    try {
      const raw = typeof window !== "undefined" && window.localStorage.getItem(WEATHER_CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (cached.latitude !== latitude || cached.longitude !== longitude) return null;
      if (Date.now() - cached.cachedAt > 15 * 60 * 1000) return null;
      return cached.data;
    } catch { return null; }
  };
  const saveWeatherCache = (data) => {
    try {
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ latitude, longitude, data, cachedAt: Date.now() }));
    } catch { /* storage full */ }
  };

  const today = todayISO();
  const greeting = greetingInfo();
  const allEvents = combineCalendarSources(events,googleEvents,feedEvents,sharedGoogleCalendarIds);

  const todaysEvents = expandRecurringEvents(allEvents,new Date(`${today}T00:00:00`),new Date(`${today}T23:59:59`))
    .filter((e) => eventOccursOnDate(e, today))
    .sort((a, b) => a.start.localeCompare(b.start));

  // Shared ingredient cache (same key/format as Meals.jsx) so the grocery
  // badge shows on today's meals without needing to open Cook Mode first.
  const INGREDIENT_CACHE_KEY = "famos:meal-ingredients:v1";
  const loadIngredientCache = () => {
    try {
      const raw = typeof window !== "undefined" && window.localStorage.getItem(INGREDIENT_CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  };
  const mealIngredientsCache = useMemo(() => loadIngredientCache(), []);
  const mealMissingCount = useMemo(() => {
    const result = {};
    for (const [mealId, names] of Object.entries(mealIngredientsCache)) {
      const namesList = Array.isArray(names) ? names : [];
      const missing = namesList.filter((name) => !groceries.some((grocery) => String(grocery?.name || "").toLowerCase() === name));
      result[mealId] = { missing: missing.length, total: namesList.length };
    }
    return result;
  }, [mealIngredientsCache, groceries]);

  const todaysTasks = tasks
    .filter((t) => t.due === today)
    .sort((a, b) => Number(a.done) - Number(b.done));
  const openTasks = tasks.filter((task) => !task.done);
  const toggleHomeTask = async task => {
    const isLastOpen = !task.done && openTasks.length === 1 && openTasks[0].id === task.id;
    const saved = await toggleTask(task.id);
    if (saved && isLastOpen && features.celebrations !== false) fireConfetti(48, 1800);
  };
  const suggestionStorageKey = household?.id && user?.id ? `famos:today-dismissed:${household.id}:${user.id}:${today}` : '';
  const [dismissedSuggestions, setDismissedSuggestions] = useState([]);
  const [suggestionClock, setSuggestionClock] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setSuggestionClock(new Date()), 60000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { try { setDismissedSuggestions(suggestionStorageKey ? JSON.parse(localStorage.getItem(suggestionStorageKey) || '[]') : []); } catch { setDismissedSuggestions([]); } }, [suggestionStorageKey]);
  const nextSuggestion = todaySuggestions({tasks, meals, events:todaysEvents, groceries, today, features, hidden:hiddenDashboardCards, dismissed:dismissedSuggestions, now:suggestionClock});
  const dismissNextSuggestion = () => { if (!nextSuggestion) return; const next = [...dismissedSuggestions, nextSuggestion.id]; setDismissedSuggestions(next); try { if (suggestionStorageKey) localStorage.setItem(suggestionStorageKey, JSON.stringify(next)); } catch { /* dismissal stays local to the session */ } };
  const homeTasks = todaysTasks.length
    ? todaysTasks
    : openTasks.slice().sort((a, b) => (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31")).slice(0, 6);
  const taskListSummaries = taskLists.map((list) => ({
    ...list,
    count: openTasks.filter((task) => task.listId === list.id).length,
  }));
  const openTaskCount = todaysTasks.filter((t) => !t.done).length;

  const activeGroceries = useMemo(() => groceries.filter((g) => !g.checked), [groceries]);

  const groceryCount = activeGroceries.length;
  const groceryCategories = Object.entries(
    activeGroceries.reduce((acc, item) => {
      const category = item.category || "Other";
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const nextEvent = todaysEvents.find((event) => new Date(event.end) > suggestionClock);
  const quickAddOptions = [
    ["calendar", "Event", CalendarPlus],
    ["tasks", "Task", ListChecks],
    ["groceries", "Groceries", ShoppingCart],
    ["meals", "Meal", ChefHat],
  ].filter(([page]) => features[page] !== false);
  const signedInMember = members.find((member) => member.id === user?.id);
  const firstName = (signedInMember?.name || profile?.display_name || "").trim().split(/\s+/)[0];
  const greetingName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : "";
  const shortenedGreeting = greeting.text.replace(/^Good\s+/i, "");
  const greetingLabel = shortenedGreeting.charAt(0).toUpperCase() + shortenedGreeting.slice(1);
  const storedLatitude = householdProfileExtra?.latitude;
  const storedLongitude = householdProfileExtra?.longitude;
  const latitude = storedLatitude === null || storedLatitude === undefined || storedLatitude === "" ? NaN : Number(storedLatitude);
  const longitude = storedLongitude === null || storedLongitude === undefined || storedLongitude === "" ? NaN : Number(storedLongitude);
  const hasWeatherLocation = Number.isFinite(latitude) && Number.isFinite(longitude);

  // Load cached weather instantly on mount, then refresh in the background.
  // Fire both the edge function and Open-Meteo in parallel — use whichever
  // returns first and prefer the edge function for richer data (alerts, name).
  const [weatherRefreshing, setWeatherRefreshing] = useState(false);
  useEffect(() => {
    if (!hasWeatherLocation) {
      setWeather(null);
      return undefined;
    }
    const controller = new AbortController();
    let cancelled = false;

    // Show cached weather immediately so the card never sits empty.
    const cached = loadWeatherCache();
    if (cached) setWeather(cached);

    // Open-Meteo — fast public API used as baseline, no cold start.
    const fromOpenMeteo = async () => {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.search = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: "temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m,is_day",
        hourly: "precipitation_probability",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        timezone: "auto",
        forecast_days: "3",
      }).toString();
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("Weather is unavailable.");
      const data = await response.json();
      const cur = data.current || {};
      const times = data.hourly?.time || [];
      const nowHour = cur.time?.slice(0, 13);
      const startIndex = Math.max(times.findIndex((time) => time.startsWith(nowHour)), 0);
      const rainChance = data.hourly?.precipitation_probability?.[startIndex] || 0;
      const daily = (data.daily?.time || []).map((date, i) => ({ date, maxC: data.daily.temperature_2m_max?.[i], minC: data.daily.temperature_2m_min?.[i], rainChance: data.daily.precipitation_probability_max?.[i] || 0, kind: wmoToKind(data.daily.weather_code?.[i]), conditionText: "" }));
      return {
        source: "open-meteo",
        location: null,
        current: { tempC: cur.temperature_2m, feelsLikeC: cur.apparent_temperature, kind: wmoToKind(cur.weather_code), conditionText: "", isDay: cur.is_day === 1, windKph: cur.wind_speed_10m || 0, humidity: cur.relative_humidity_2m || 0, uv: 0, rainChance },
        daily,
        alerts: [],
      };
    };

    setWeatherRefreshing(true);
    const run = async () => {
      // Fire both in parallel — Open-Meteo is fast (no cold start) and edge has richer data.
      const results = await Promise.allSettled([
        // Edge function (preferred for alerts + location name)
        (async () => {
          if (!supabase) throw new Error("Live sync isn't ready yet.");
          const { data, error } = await supabase.functions.invoke("weather", { body: { latitude, longitude, days: 3 } });
          if (error || !data || data.error || !data.current) throw error || new Error("No weather data");
          return { source: "edge", ...data };
        })(),
        // Open-Meteo (fast fallback)
        fromOpenMeteo(),
      ]);

      if (cancelled) return;

      // Prefer edge function result (richer data), otherwise use Open-Meteo.
      let best = null;
      if (results[0].status === "fulfilled" && results[0].value.current) best = results[0].value;
      else if (results[1].status === "fulfilled" && results[1].value.current) best = results[1].value;

      if (best) {
        setWeather(best);
        setWeatherError("");
        saveWeatherCache(best);
      } else if (!cached) {
        // Both failed and no cache to fall back on.
        const reason = results[0].reason || results[1].reason;
        setWeatherError(reason?.message || "Weather is unavailable.");
      }
      if (!cancelled) setWeatherRefreshing(false);
    };
    run();
    return () => { cancelled = true; controller.abort(); };
  }, [hasWeatherLocation, latitude, longitude]);

  const weatherNow = weather?.current;
  const weatherRisk = weatherNow && (weatherNow.rainChance >= 50 || weatherNow.windKph >= 40);
  const disruptedEvents = weatherRisk ? todaysEvents.filter((event) => event.location) : [];
  const latestMessages = useMemo(() => (messages || [])
    .filter((message) => !message.broadcast && (!message.recipientId || message.senderId === currentUserId || message.recipientId === currentUserId))
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
    .slice(0, 4), [messages, currentUserId]);

  const refreshAll = async () => {
    await refreshData();
    if (googleConnected) await syncGoogleCalendarNow();
  };

  return (
    <PullToRefresh onRefresh={refreshAll}>
    <div className="pb-28 reference-dashboard famos-noscroll">
      <PageHeader
        title={tabletMode ? `${greetingLabel}, family` : `${greetingLabel}${greetingName ? `, ${greetingName}` : ""}`}
        subtitle={fullDateLabel(today)}
        illustration="home"
        action={<button type="button" className={`today-customize-trigger ${editingDashboard ? "active" : ""}`} onClick={() => setEditingDashboard((current) => !current)} aria-expanded={editingDashboard}><LayoutGrid size={16}/>{editingDashboard ? "Done" : "Customize"}</button>}
      />

      <section className="today-first-actions" aria-label="Today's plan">
        {quickAddOptions.length > 0 && <details className="today-quick-add">
          <summary><Plus size={20} /> Quick add</summary>
          <div>{quickAddOptions.map(([page, label, Icon]) => (
            <button type="button" key={page} onClick={(event) => {
              event.currentTarget.closest("details").open = false;
              if (goTo(page) !== false) requestPageAdd(page);
            }}><Icon size={18} /> {label}</button>
          ))}</div>
        </details>}
        {features.calendar && !hiddenDashboardCards.includes("calendar") && nextEvent && (
          <button type="button" className="today-up-next" onClick={() => goTo("calendar")}>
            <span className="today-up-next-icon"><CalendarPlus size={20} /></span>
            <span><small>Up next</small><strong>{nextEvent.title}</strong>
              <small>{isAllDayEvent(nextEvent) ? "All day" : formatTime(nextEvent.start)}</small></span>
            <ChevronRight size={18} />
          </button>
        )}
        {(!features.calendar || hiddenDashboardCards.includes("calendar") || !nextEvent) && nextSuggestion && !editingDashboard && (
          <NextSuggestion suggestion={nextSuggestion} onOpen={goTo} onDismiss={dismissNextSuggestion} />
        )}
      </section>

      <TodayAtAGlance features={features} hidden={hiddenDashboardCards} eventCount={todaysEvents.length} taskCount={openTasks.length} dinner={meals.find(meal => meal.date === today && meal.slot === 'dinner')?.title} shoppingCount={activeGroceries.length} onSelect={goTo} />

      <WeeklyPlanner events={allEvents} tasks={tasks} meals={meals} members={members} features={features} onNavigate={goTo} onInvite={inviteFromWeek} addTask={addTask} firstGoal={features[firstGoal] === false ? '' : firstGoal} onClearGoal={clearFirstGoal} />



      <details className="reference-home-overview px-5"><summary>Family members</summary>
        <div className="reference-family-strip" aria-label="Your family">{members.map(member => <div key={member.id}><Avatar member={member} size="lg"/><span>{member.name?.split(' ')[0]}</span></div>)}<button type="button" onClick={() => goTo('settings')} aria-label="Manage family members">+</button></div>
      </details>
      <div className="px-5"><ProductUpdateBanner /></div>

      {/* TODO: Enable when email parser is ready to deploy */false && <div className="px-5"><EmailInbox compact /></div>}

      {!IS_APP_STORE && isTrial && (
        <div className="today-trial-banner">
          <Sparkles size={18} />
          <div>
            <strong>FamOS {(subscription?.plan || subscription?.plan_key) === "plus" ? "Plus" : "Pro"} trial — {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left</strong>
            <span>All features are unlocked during your trial. Cancel anytime from Settings.</span>
          </div>
        </div>
      )}

      {!IS_APP_STORE && isExpired && (
        <div className="today-trial-expired">
          <Sparkles size={18} />
          <div>
            <strong>Your FamOS {(subscription?.plan || subscription?.plan_key) === "plus" ? "Plus" : "Pro"} trial has ended</strong>
            <span>Upgrade to keep using advanced features like calendar sync, recipes, and Fam AI.</span>
          </div>
          <button type="button" onClick={() => goTo("settings")}>Upgrade</button>
        </div>
      )}

      <TodayCustomizer open={editingDashboard} onClose={() => setEditingDashboard(false)} cards={dashboardOrder.filter(dashboardEnabled).map((id) => DASHBOARD_CARDS.find((item) => item.id === id))} hidden={hiddenDashboardCards} onToggle={toggleDashboardCard} onMove={moveDashboardCard} onReset={() => { setDashboardOrder(defaultDashboardOrder); setHiddenDashboardCards([]); setCardSizes({}); }} />

      <NativeAdBanner placement={AD_PLACEMENTS.HOME} />

      <div className="px-5 mt-2 today-bento-grid">
        <Card className={`weather-now-card p-4 `} style={dashboardPosition("weather")}>
          {weather?.alerts?.length > 0 && (
            <div className="weather-alerts">
              {weather.alerts.map((alert, index) => (
                <div className="weather-alert" key={`${alert.event}-${index}`}>
                  <TriangleAlert size={16} />
                  <span><strong>{alert.event}</strong>{alert.headline && <small>{alert.headline}</small>}</span>
                </div>
              ))}
            </div>
          )}
          <div className={`weather-now-main ${!weatherNow ? "weather-skeleton" : ""} ${weatherRefreshing && weatherNow ? "weather-refreshing" : ""}`}>
            <span className={`weather-now-glyph ${weatherRisk ? "risk" : ""}`}>
              {weatherNow ? <WeatherGlyph kind={weatherNow.kind} isDay={weatherNow.isDay} size={24} /> : <div className="weather-skeleton-icon" />}
            </span>
            <div>
              <strong>{weatherNow ? `${roundTemp(weatherNow.tempC)}°` : <span className="weather-skeleton-line weather-skeleton-line-temp" />}</strong>
              <small>{weatherNow ? `${conditionLabel(weatherNow)} · ${weather?.location?.name || householdProfileExtra?.city || householdProfileExtra?.address || "Your area"}` : <span className="weather-skeleton-line weather-skeleton-line-loc" />}</small>
            </div>
            {weatherNow && <p>{weatherRefreshing && <span className="weather-refresh-dot" />}<Droplets size={13} /> {weatherNow.rainChance}% · Feels {roundTemp(weatherNow.feelsLikeC)}° · <Wind size={13} /> {Math.round(weatherNow.windKph)} km/h</p>}
          </div>
          {weather?.daily?.length > 0 && <div className="weather-daily today-weather-outlook" aria-label="Three day weather outlook">
            {weather.daily.slice(0, 3).map((day, index) => <div className="weather-day" key={day.date || index}>
              <span className="weather-day-label">{index === 0 ? "Today" : new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</span>
              <WeatherGlyph kind={day.kind} isDay size={17}/>
              <span className={`weather-day-rain ${day.rainChance >= 40 ? "wet" : ""}`}><Droplets size={11}/>{Math.round(day.rainChance || 0)}%</span>
              <span className="weather-day-temps"><strong>{roundTemp(day.maxC)}°</strong><em>{roundTemp(day.minC)}°</em></span>
            </div>)}
          </div>}
          {!hasWeatherLocation && <button onClick={() => goTo("settings")} className="weather-address-action"><MapPin size={16} /><span><strong>Add an address to turn on weather</strong><small>FamOS will also flag today’s location-based events when weather may disrupt them.</small></span><ChevronRight size={16} /></button>}
          {features.calendar && disruptedEvents.length > 0 && <button onClick={() => goTo("calendar")} className="weather-event-warning"><CloudRain size={16} /><span><strong>Weather may affect {disruptedEvents.length} event{disruptedEvents.length === 1 ? "" : "s"} today</strong><small>{disruptedEvents.map((event) => event.title).join(", ")}</small></span><ChevronRight size={16} /></button>}
          {weatherError && <small className="address-autocomplete-warning">{weatherError}</small>}
        </Card>
        <section className={`today-bento-kitchen `} aria-labelledby="kitchen-watch-title" style={dashboardPosition("kitchen")}>
          <Card className="p-0 overflow-hidden border-0 shadow-sm">
            {/* Kitchen Watch header */}
            <div className="px-4 pt-4 pb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#D94F4F] mb-1">Track what's expiring</p>
              <h2 id="kitchen-watch-title" className="ui-section-title">Kitchen Watch</h2>
              <p className="text-[12px] text-[var(--color-ink-soft)] mt-1">See what needs to be used soon.</p>
            </div>
            {/* Expiring soon banner */}
            {expiryAlerts.length > 0 && (
              <div className="mx-4 mt-2 mb-3 flex items-center gap-2 rounded-xl px-3.5 py-2.5" style={{ background: 'linear-gradient(135deg, rgba(254,226,226,0.7) 0%, rgba(254,205,211,0.5) 100%)', border: '1px solid rgba(252,165,165,0.3)' }}>
                <Bell size={16} className="text-[#D94F4F] shrink-0" />
                <span className="text-[13px] font-semibold text-[#D94F4F]">
                  {expiryAlerts.length} Item{expiryAlerts.length === 1 ? '' : 's'} expiring soon
                </span>
              </div>
            )}
            {/* Show all watch items with expiry status */}
            {inventoryItems.length > 0 ? (
              <div className="px-4 pb-4 space-y-3">
                {(expiryAlerts.length > 0 ? expiryAlerts : inventoryItems.slice(0, 4)).slice(0, 4).map((item) => {
                  const alreadyListed = replacementIds.has(item.id) || groceries.some((grocery) => !grocery?.checked && String(grocery?.name || "").toLowerCase() === String(item?.name || "").toLowerCase());
                  const expiryStatus = item.expiry || inventoryExpiryStatus(item);
                  const isExpired = expiryStatus?.state === 'expired';
                  const isSoon = expiryStatus?.state === 'soon';
                  const categoryLabel = item.category || 'Uncategorised';
                  return (
                    <div key={item.id} className="kw-card">
                      <div className="kw-card-top">
                        <span className="kw-card-category">
                          <Refrigerator size={12} /> {categoryLabel}
                        </span>
                        {item.expiresOn && (
                          <span className="kw-card-date">
                            {new Date(`${item.expiresOn}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <h3 className="kw-card-name">{item.name}</h3>
                      <div className="kw-card-bottom">
                        <div className="kw-card-actions">
                          <button
                            type="button"
                            disabled={alreadyListed}
                            style={{display:features.groceries?undefined:"none"}} onClick={() => replaceInventoryItem(item)}
                            className={isExpired ? 'kw-card-action kw-card-action-replace' : 'kw-card-action kw-card-action-date'}
                          >
                            {alreadyListed ? 'On list' : isExpired ? 'Replace item' : item.expiresOn ? 'Change date' : 'Set date'}
                          </button>
                          <button type="button" onClick={() => removeInventoryItem(item.id)} className="kw-card-delete" aria-label="Delete item">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="kw-card-status">
                          <span className={isExpired ? 'kw-status-text kw-status-expired' : isSoon ? 'kw-status-text kw-status-ok' : 'kw-status-text'} style={(!isExpired && !isSoon) ? {color: 'var(--color-ink-soft)'} : undefined}>
                            {isExpired ? 'Expired' : expiryStatus?.label || (item.expiresOn ? 'Fresh' : 'No expiry set')}
                          </span>
                          <span className="kw-card-location">{item.location || 'Kitchen'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <button type="button" className="today-kitchen-empty" onClick={() => goTo("kitchen")}>
                <Refrigerator size={18}/><span><strong>Your kitchen tracker is ready</strong><small>Check off shopping items, then move them into the fridge, freezer, or pantry.</small></span><ChevronRight size={15}/>
              </button>
            )}
            {notificationPermission !== "granted" && expiryAlerts.length > 0 && (
              <div className="px-4 pb-4">
                <button type="button" onClick={requestNotifications} className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] py-2.5 text-[12px] font-semibold text-[var(--color-ink-soft)]">
                  <Bell size={14} /> Remind me about expiring items
                </button>
              </div>
            )}
            <button type="button" onClick={() => goTo("kitchen")} className="w-full px-4 py-3 text-left text-[12px] font-semibold text-[var(--color-accent-strong)] border-t border-[var(--color-border)]">
              Open Kitchen Watch →
            </button>
          </Card>
        </section>
        <section className={`today-bento-schedule `} style={dashboardPosition("schedule")}>
          <Card className="today-flow-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">Today’s schedule</p>
                <h2 className="ui-section-title">Today’s schedule</h2>
              </div>
              <button onClick={() => goTo("calendar")} className="text-[13px] font-semibold text-[var(--color-accent)] flex items-center gap-0.5">
                Full calendar <ChevronRight size={14} />
              </button>
            </div>
            {todaysEvents.length === 0 ? (
              <EmptyState illustration="calendar" title="No events today" subtitle="See what’s ahead or make a plan together." actionLabel="Open calendar" onAction={() => goTo('calendar')} />
            ) : (
              <div className="event-carousel-wrapper"><div className="event-carousel today-event-carousel">
                {todaysEvents.slice(0, 5).map((ev) => {
                  const evMembers = (ev.memberIds || []).map((id) => memberById[id]).filter(Boolean);
                  const isPast = new Date(ev.end) < new Date();
                  const typeStyle = EVENT_TYPES[eventType(ev)];
                  return (
                    <div
                      className={`event-carousel-card today-event-card ${isPast ? "today-event-past" : ""}`}
                      key={ev.id}
                      onClick={() => goTo("calendar")}
                    >
                      <div className="event-carousel-body">
                        <div className="event-carousel-date today-event-date">
                          <span className="today-event-type-pill" style={{ background: typeStyle.color }}>{typeStyle.label}</span>
                          <span>{isAllDayEvent(ev) ? "All day" : formatTime(ev.start)}</span>
                          {ev.end && !isAllDayEvent(ev) && <small>{formatTime(ev.end)}</small>}
                        </div>
                        <h3>{ev.title}</h3>
                        {ev.location && (
                          <span className="event-carousel-location">
                            <MapPin size={12} /> {ev.location}
                          </span>
                        )}
                        <div className="event-carousel-footer">
                          {evMembers.length > 0 && <AvatarStack members={evMembers} size="sm" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div></div>
            )}
          </Card>

        </section>

        <section className="m3-grid lg:grid-cols-2 today-bento-meal-grid">
          <Card className={`today-meals-card p-4 `} style={dashboardPosition("meals")}>
            <div className="flex items-center gap-3 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">Meals</p>
                <h2 className="ui-section-title">Meal plan</h2>
              </div>
            </div>
            <div className="today-daily-meals">
              {TODAY_MEAL_SLOTS.map(({ id: slot, label }) => {
                const meal = meals.find((m) => m.date === today && m.slot === slot && m.title);
                const adder = meal?.createdBy ? memberById[meal.createdBy] : null;
                const suggestedMeal = meal?.source === "spoonacular";
                const openCook = () => {
                  if (!suggestedMeal) return;
                  try { window.sessionStorage.setItem("famos:cook-intent:v1", meal.id || `${today}:${slot}`); } catch { /* private mode */ }
                  goTo("meals");
                };
                const findMealIdeas = () => {
                  try { window.sessionStorage.setItem("famos:meal-ideas-intent:v1", JSON.stringify({date:today,slot})); } catch { /* private mode */ }
                  goTo("meals");
                };
                return (
                  <article key={slot} className={`today-daily-meal ${meal ? "is-planned" : "is-open"}`}>
                    <span className="today-daily-meal-icon"><MealSlotArt slot={slot} /></span>
                    <div className="today-daily-meal-copy">
                      {suggestedMeal && meal.thumbnail && <img className="today-daily-meal-thumb" src={meal.thumbnail} alt="" loading="lazy" />}
                      <span>{label}</span>
                      <strong>{meal?.title || `Nothing planned for ${label.toLowerCase()}`}</strong>
                      {adder && <small><Avatar member={adder} size="xs" /> Added by {adder.name}</small>}
                    </div>
                    {(() => {
                      const badge = meal?.id && mealMissingCount[meal.id];
                      if (!badge) return null;
                      return (
                        <span className={`today-meal-badge ${badge.missing === 0 ? "covered" : "needs"}`}>
                          <ShoppingCart size={11} />
                          {badge.missing === 0 ? "Groceries ready" : `${badge.missing} missing`}
                        </span>
                      );
                    })()}
                    {(!meal || suggestedMeal) && (
                      <div className="today-daily-meal-actions is-single">
                        {meal ? (
                          <button type="button" className="cook" aria-label={`Cook ${meal.title}`} onClick={openCook}><ChefHat size={14} /> Cook</button>
                        ) : (
                          <button type="button" className="plan" aria-label={`Find meal ideas for ${label}`} onClick={findMealIdeas}><CalendarPlus size={14} /> Ideas</button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </Card>

          <Card className={`today-groceries-card p-4 `} style={dashboardPosition("groceries")}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">Shopping</p>
                <h2 className="ui-section-title">Grocery list</h2>
              </div>
              <button onClick={() => goTo("groceries")} className="text-[13px] font-semibold text-[var(--color-accent)] flex items-center gap-0.5">
                View list <ChevronRight size={14} />
              </button>
            </div>
            {activeGroceries.length === 0 ? (
              <EmptyState illustration="groceries" title="Your list is ready" subtitle="Add anything your family needs for the next trip." actionLabel="Open shopping" onAction={() => goTo('groceries')} />
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {groceryCategories.slice(0, 4).map(([category, count]) => (
                    <span key={category} className="today-category-chip inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-good)]">{category} · {count}</span>
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {activeGroceries.slice(0, 6).map((item) => (
                    <div key={item.id} className="today-list-item rounded-2xl bg-[var(--color-surface)] px-3 py-2.5">
                      <p className="text-[13px] font-semibold text-[var(--color-ink)] truncate">{item.name}</p>
                      <p className="text-[11.5px] text-[var(--color-ink-soft)]">{item.category || "Other"}{item.quantity ? ` · ${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : ""}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </section>

        <section className={`today-bento-tasks `} style={dashboardPosition("tasks")}>
          <Card className="today-tasks-card p-4 bg-family-soft">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">Tasks</p>
                <h2 className="ui-section-title">Tasks & lists</h2>
              </div>
              <button onClick={() => goTo("tasks")} className="text-[13px] font-semibold text-[var(--color-accent)] flex items-center gap-0.5">
                View tasks <ChevronRight size={14} />
              </button>
            </div>
            {taskListSummaries.length > 0 && <div className="today-task-lists" aria-label="Task lists">
              {taskListSummaries.slice(0, 5).map((list) => <button type="button" key={list.id} onClick={() => goTo("tasks")} style={{ "--task-list-color": list.color || "var(--color-tasks)" }}><i/><span>{list.name}</span><em>{list.count}</em></button>)}
            </div>}
            {homeTasks.length === 0 ? (
              <div className="today-compact-empty">
                <EmptyState illustration="tasks" title={taskLists.length ? "Your lists are clear" : "No tasks yet"} subtitle={taskLists.length ? "Nothing open right now." : "Create a list for the things your family keeps passing around."} />
              </div>
            ) : (
              <ul className="grid md:grid-cols-2 gap-2">
                {homeTasks.map((t) => {
                  const assignee = memberById[t.assigneeId];
                  const taskList = taskLists.find((list) => list.id === t.listId);
                  return (
                    <li key={t.id} className="today-list-item flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-[var(--color-surface)]">
                      <Checkbox checked={t.done} onChange={() => toggleHomeTask(t)} color={assignee?.color} />
                      <div className="flex-1 min-w-0">
                        <span className={`block text-[14px] ${t.done ? "line-through text-[var(--color-ink-faint)]" : "text-[var(--color-ink)]"} truncate`}>{t.title}</span>
                        <small className="today-task-meta">{[taskList?.name, t.due === today ? "Today" : t.due ? new Date(`${t.due}T12:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" }) : "No due date"].filter(Boolean).join(" · ")}</small>
                      </div>
                      {assignee && <Avatar member={assignee} size="sm" />}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
        <section className={`today-bento-messages `} aria-labelledby="latest-family-messages" style={dashboardPosition("messages")}>
          <Card className="today-messages-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">Family chat</p><h2 id="latest-family-messages" className="ui-section-title">Latest messages</h2></div>
              <button onClick={() => goTo("chat")} className="text-[13px] font-semibold text-[var(--color-accent)] flex items-center gap-0.5">Open chat <ChevronRight size={14}/></button>
            </div>
            {latestMessages.length ? <div className="today-message-list">{latestMessages.map((message) => {
              const sender = memberById[message.senderId];
              const direct = Boolean(message.recipientId);
              return <button type="button" key={message.id} onClick={() => goTo("chat")}><Avatar member={sender || { name: "Family" }} size="sm"/><span><strong>{sender?.name || "Family member"}{direct ? " · Direct" : ""}</strong><small>{message.text}</small></span><time>{new Date(message.sentAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></button>;
            })}</div> : <button type="button" className="today-message-empty" onClick={() => goTo("chat")}><MessageCircle size={18}/><span><strong>The family chat is quiet</strong><small>Send a message to your family.</small></span></button>}
          </Card>
        </section>
      </div>
    </div>
    </PullToRefresh>
  );
}
