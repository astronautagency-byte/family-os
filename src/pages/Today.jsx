import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Bell, CalendarPlus, ChefHat, ChevronRight, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Coffee, Droplets, ExternalLink, GripVertical, LayoutGrid, ListChecks, LoaderCircle, MapPin, Megaphone, MessageCircle, Moon, PartyPopper, Refrigerator, RotateCcw, ShoppingCart, Soup, Sparkles, Sun, Ticket, Trash2, TriangleAlert, Wind, X } from "lucide-react";
// ChefHat is already imported above for the Cook button icon.
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { BROADCAST_REACTIONS, useFamily } from "../context/FamilyContext";
import { useAuth } from "../context/AuthContext";
import { Avatar, AvatarStack, Card, Checkbox, EmptyState } from "../components/ui";
import PageHeader from "../components/PageHeader";
import PullToRefresh from "../components/PullToRefresh";
import { supabase } from "../lib/supabase";
import { dailyEncouragement, formatTime, fullDateLabel, greetingInfo, todayISO } from "../lib/dates";
import useKitchenInventory from "../hooks/useKitchenInventory";
import { expiringInventory } from "../lib/inventoryExpiry";
import NativeAdBanner from "../components/NativeAdBanner";
import { AD_PLACEMENTS } from "../lib/adNetwork";

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
  { id: "breakfast", label: "Breakfast", icon: Coffee },
  { id: "lunch", label: "Lunch", icon: Soup },
  { id: "dinner", label: "Dinner", icon: ChefHat },
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
const defaultDashboardOrder = DASHBOARD_CARDS.map((card) => card.id);
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

function DashboardMoveHandle({ id, label, order, onMove }) {
  const index = order.indexOf(id);
  return <div className="today-card-move-handle" aria-label={`Move ${label}`}>
    <GripVertical size={16} aria-hidden="true"/>
    <span>Drag {label}</span>
    <button type="button" onClick={() => onMove(id, -1)} disabled={index === 0} aria-label={`Move ${label} earlier`}><ArrowUp size={14}/></button>
    <button type="button" onClick={() => onMove(id, 1)} disabled={index === order.length - 1} aria-label={`Move ${label} later`}><ArrowDown size={14}/></button>
  </div>;
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

// Tap-to-prepend emoji "stickers" used to live INSIDE the input box but the
// family-feedback round flagged them as noisy — replaced with a single
// announcement icon that matches the rest of the site's icon vocabulary
// (40×40 rounded-12 accent-soft tile + accent-colored lucide icon).

// Friendly rotating placeholders shown when the input is empty and unfocused.
// Mirrors the spirit of the deleted Quick-start chips but stays inline as a
// single line of hint copy. Cycles every 4.5s; pauses on focus / typed text.
const BROADCAST_PLACEHOLDERS = [
  "Say hi to the family",
  "What's happening tonight?",
  "Big news — share it",
  "Heads up, family",
  "Tell everyone you're thinking of them",
];

// Confetti palette matches the daypart sunrise gradient (kept in CSS vars so the
// day/morning/evening variants pick up automatically).
const CONFETTI_COLORS = [
  "var(--color-accent)",
  "var(--color-fam-rose)",
  "var(--color-fam-marigold)",
  "var(--color-fam-plum)",
  "var(--color-fam-sky)",
];


function BroadcastBanner({ item, sender, reactions, currentUserId, onReact, onClear }) {
  const ref = useRef(null);
  useGSAP(() => {
    if (!ref.current) return undefined;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(ref.current, { autoAlpha: 0, y: -20, scale: 0.92 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.7)" });
      // Stagger reaction buttons in after the banner lands
      const buttons = ref.current.querySelectorAll(".broadcast-reaction");
      gsap.fromTo(buttons, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.35, stagger: 0.08, ease: "back.out(2)", delay: 0.3 });
    });
    return () => media.revert();
  }, { scope: ref });

  return (
    <div className="broadcast-banner" ref={ref}>
      <div className="broadcast-banner-accent" />
      {sender ? <Avatar member={sender} size="md" /> : <span className="broadcast-banner-icon"><Megaphone size={18} /></span>}
      <div className="broadcast-banner-body">
        <div className="broadcast-banner-meta">
          <strong>{sender?.name || "Family"}</strong>
          <span className="broadcast-banner-time">{formatTime(item.sentAt)}</span>
        </div>
        <p>{item.text}</p>
        <div className="broadcast-reactions">
          {BROADCAST_REACTIONS.map((emoji) => {
            const list = reactions.filter((reaction) => reaction.reaction === emoji);
            const mine = list.some((reaction) => reaction.memberId === currentUserId);
            return (
              <button
                key={emoji}
                className={`broadcast-reaction ${mine ? "reacted" : ""} ${list.length ? "" : "empty"}`}
                onClick={() => onReact(item.id, emoji)}
                aria-label={`React ${emoji}${list.length ? ` (${list.length})` : ""}`}
                aria-pressed={mine}
              >
                <span aria-hidden="true">{emoji}</span>
                {list.length > 0 && <em>{list.length}</em>}
              </button>
            );
          })}
        </div>
      </div>
      <button className="broadcast-banner-clear" onClick={() => onClear(item.id)} aria-label="Clear broadcast"><X size={16} /></button>
    </div>
  );
}

export default function Today({ goTo }) {
  const { members, memberById, events, googleEvents, feedEvents, meals, tasks, taskLists = [], groceries, messages, addGrocery, toggleTask, tabletMode, broadcasts, broadcastMessage, clearBroadcast, reactionsByMessage, reactToBroadcast, currentUserId, refreshData, syncGoogleCalendarNow, googleConnected, notificationPermission, requestNotifications } = useFamily();
  const { profile, user, household, householdProfileExtra } = useAuth();
  const { items: inventoryItems, removeItem: removeInventoryItem } = useKitchenInventory(household?.id, user?.id);
  const expiryAlerts = useMemo(() => expiringInventory(inventoryItems), [inventoryItems]);
  const [replacementIds, setReplacementIds] = useState(() => new Set());
  const [remindedIds, setRemindedIds] = useState(() => new Set());
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastError, setBroadcastError] = useState("");
  const [broadcastFocused, setBroadcastFocused] = useState(false);
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
  const composeContainerRef = useRef(null);
  const draggedDashboardCard = useRef(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

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
    if (id === "broadcast") {
      return { 
        order: dashboardOrder.indexOf(id) + 1, 
        display: hiddenDashboardCards.includes(id) ? "none" : undefined,
        gridColumn: "1 / -1",
      };
    }
    return { 
      order: dashboardOrder.indexOf(id) + 1, 
      display: hiddenDashboardCards.includes(id) ? "none" : undefined,
    };
  };
  const toggleDashboardCard = (id) => setHiddenDashboardCards((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const moveDashboardCard = (id, direction) => {
    setDashboardOrder((current) => {
      const from = current.indexOf(id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };
  const dashboardDragProps = (id) => ({
    draggable: editingDashboard,
    "data-dashboard-card": id,
    onDragStart: (event) => {
      if (!editingDashboard) return;
      draggedDashboardCard.current = id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
      event.currentTarget.classList.add("is-dragging");
    },
    onDragOver: (event) => { if (editingDashboard) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } },
    onDrop: (event) => {
      if (!editingDashboard) return;
      event.preventDefault();
      const source = draggedDashboardCard.current || event.dataTransfer.getData("text/plain");
      if (!source || source === id) return;
      setDashboardOrder((current) => {
        const next = current.filter((cardId) => cardId !== source);
        next.splice(next.indexOf(id), 0, source);
        return next;
      });
    },
    onDragEnd: (event) => {
      event.currentTarget.classList.remove("is-dragging");
      draggedDashboardCard.current = null;
    },
  });
  const moveHandle = (id) => editingDashboard ? <DashboardMoveHandle id={id} label={DASHBOARD_CARDS.find((card) => card.id === id)?.label || id} order={dashboardOrder} onMove={moveDashboardCard}/> : null;

  useEffect(() => {
    if (!expiryAlerts.length || notificationPermission !== "granted" || typeof window === "undefined") return;
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
  }, [expiryAlerts, household?.id, notificationPermission]);

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

  // Cycle through friendly placeholders while the composer is "true empty"
  // (no focus, no text). The moment a user touches it, the cycling stops so
  // the placeholder never competes with what they're typing.
  useEffect(() => {
    if (broadcastFocused || broadcastText.length > 0) return undefined;
    const id = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % BROADCAST_PLACEHOLDERS.length);
    }, 4500);
    return () => clearInterval(id);
  }, [broadcastFocused, broadcastText]);

  // Tiny DOM confetti burst on successful broadcast. Pure CSS keyframe — no
  // dependency, micro-cost, removed after one play. The CSS rules also honour
  // prefers-reduced-motion via @media, but the early-return here avoids even
  // creating the DOM nodes for users who opt out of motion.
  const fireConfetti = () => {
    const host = composeContainerRef.current;
    if (!host) return;
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const count = 14;
    for (let i = 0; i < count; i += 1) {
      const dot = document.createElement("span");
      dot.className = "broadcast-confetti";
      dot.style.setProperty("--c", CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
      // Spread upward, slightly to the right (where the button sits), with some variance.
      dot.style.setProperty("--x", `${(Math.random() * 160 - 30).toFixed(0)}px`);
      dot.style.setProperty("--y", `${(-30 - Math.random() * 90).toFixed(0)}px`);
      dot.style.setProperty("--rot", `${(Math.random() * 540 - 90).toFixed(0)}deg`);
      dot.style.animationDelay = `${(Math.random() * 0.08).toFixed(2)}s`;
      host.appendChild(dot);
      setTimeout(() => dot.remove(), 1300);
    }
  };



  const postBroadcast = async (event) => {
    event.preventDefault();
    if (!broadcastText.trim() || broadcasting) return;
    setBroadcasting(true); setBroadcastError("");
    try {
      await broadcastMessage(broadcastText.trim());
      setBroadcastText("");
      fireConfetti();
    }
    catch (error) { setBroadcastError(error.message || "Could not broadcast right now."); }
    finally { setBroadcasting(false); }
  };
  const broadcastReady = broadcastText.trim().length > 0;
  // Hide the wiggle + chips whenever the composer is "engaged" — text entered,
  // focused, or actively sending a message. CSS owns the wiggle keyframe; we
  // just flip the `is-idle` class.
  const composerIdle = !broadcastReady && !broadcastFocused && !broadcasting;
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
  const allEvents = [...events, ...googleEvents, ...feedEvents];

  const todaysEvents = allEvents
    .filter((e) => e.start.slice(0, 10) === today)
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

  const nextEvent = todaysEvents.find((e) => new Date(e.end) > new Date());
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
    <div className="pb-24 reference-dashboard famos-noscroll">
      <PageHeader
        eyebrow={fullDateLabel(today)}
        title={tabletMode ? `${greetingLabel}, family` : `${greetingLabel}${greetingName ? `, ${greetingName}` : ""}`}
        subtitle={dailyEncouragement(today)}
        illustration="home"
        action={<button type="button" className={`today-customize-trigger ${editingDashboard ? "active" : ""}`} onClick={() => setEditingDashboard((current) => !current)} aria-expanded={editingDashboard}><LayoutGrid size={16}/>{editingDashboard ? "Done" : "Customize"}</button>}
      />

      {editingDashboard && <div className="today-customize-panel mx-5"><div className="today-customize-hint"><span><GripVertical size={15}/> Choose what appears, then drag cards to rearrange them.</span><button type="button" onClick={() => { setDashboardOrder(defaultDashboardOrder); setHiddenDashboardCards([]); setCardSizes({}); }}><RotateCcw size={14}/> Reset</button></div><div className="today-card-toggles">{DASHBOARD_CARDS.map((card) => { const visible = !hiddenDashboardCards.includes(card.id); return <label key={card.id}><input type="checkbox" checked={visible} onChange={() => toggleDashboardCard(card.id)}/><span aria-hidden="true"/><strong>{card.label}</strong></label>; })}</div></div>}

      <NativeAdBanner placement={AD_PLACEMENTS.HOME} />

      <div className="px-5 mt-2 today-bento-grid">
        <section className="broadcast-home" aria-label="Family broadcast">
          <div className="broadcast-confetti-host" ref={composeContainerRef}>
            <form
              className="broadcast-compose"
              onSubmit={postBroadcast}
            >
              <span
                className={`broadcast-compose-icon ${composerIdle ? "is-idle" : ""}`}
                aria-hidden="true"
              ><Megaphone size={18} color="var(--color-accent)" /></span>
              <input
                value={broadcastText}
                onChange={(event) => setBroadcastText(event.target.value)}
                onFocus={() => setBroadcastFocused(true)}
                onBlur={() => setBroadcastFocused(false)}
                placeholder={BROADCAST_PLACEHOLDERS[placeholderIdx]}
                aria-label="Broadcast a message to the family"
                maxLength={4000}
              />
              <button type="submit" className={`broadcast-submit ${broadcastReady ? "is-ready" : ""}`} disabled={!broadcastReady || broadcasting} aria-live="polite">
                {broadcasting ? <LoaderCircle className="broadcast-spin" size={14} aria-hidden="true" /> : <PartyPopper size={14} aria-hidden="true" />}
                {broadcasting ? "Sending…" : "Broadcast"}
              </button>
            </form>
          </div>
          {broadcastError && <p className="broadcast-compose-error">{broadcastError}</p>}
          {broadcasts.length > 0 && (
            <div className="broadcast-banner-list">
              {broadcasts.map((item) => (
                <BroadcastBanner
                  key={item.id}
                  item={item}
                  sender={memberById[item.senderId]}
                  reactions={reactionsByMessage[item.id] || []}
                  currentUserId={currentUserId}
                  onReact={reactToBroadcast}
                  onClear={clearBroadcast}
                />
              ))}
            </div>
          )}
        </section>
        <Card className={`weather-now-card p-4 ${editingDashboard ? "is-customizing" : ""}`} style={dashboardPosition("weather")} {...dashboardDragProps("weather")}>
          {moveHandle("weather")}
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
          {disruptedEvents.length > 0 && <button onClick={() => goTo("calendar")} className="weather-event-warning"><CloudRain size={16} /><span><strong>Weather may affect {disruptedEvents.length} event{disruptedEvents.length === 1 ? "" : "s"} today</strong><small>{disruptedEvents.map((event) => event.title).join(", ")}</small></span><ChevronRight size={16} /></button>}
          {weatherError && <small className="address-autocomplete-warning">{weatherError}</small>}
        </Card>
        <section className={`today-bento-kitchen ${editingDashboard ? "is-customizing" : ""}`} aria-labelledby="kitchen-watch-title" style={dashboardPosition("kitchen")} {...dashboardDragProps("kitchen")}>
          {moveHandle("kitchen")}
          <Card className="p-0 overflow-hidden border-0 shadow-sm">
            {/* Kitchen Watch header */}
            <div className="px-4 pt-4 pb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#D94F4F] mb-1">Track what's expiring</p>
              <h2 id="kitchen-watch-title" className="text-[22px] font-bold text-[var(--color-ink)] leading-tight">Kitchen Watch</h2>
              <p className="text-[12px] text-[var(--color-ink-soft)] mt-1">A few taps now can prevent a kitchen-table summit later.</p>
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
            {/* Expiry items */}
            {expiryAlerts.length > 0 ? (
              <div className="px-4 pb-4 space-y-3">
                {expiryAlerts.slice(0, 4).map((item) => {
                  const alreadyListed = replacementIds.has(item.id) || groceries.some((grocery) => !grocery?.checked && String(grocery?.name || "").toLowerCase() === String(item?.name || "").toLowerCase());
                  const isExpired = item.expiry.state === 'expired';
                  const daysLeft = item.expiry.daysLeft;
                  const categoryLabel = item.category || 'Uncategorised';
                  return (
                    <div key={item.id} className="kw-card">
                      <div className="kw-card-top">
                        <span className="kw-card-category">
                          <Refrigerator size={12} /> {categoryLabel}
                        </span>
                        <span className="kw-card-date">
                          {new Date(`${item.expiresOn || item.expiresOn}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="kw-card-name">{item.name}</h3>
                      <div className="kw-card-bottom">
                        <div className="kw-card-actions">
                          <button
                            type="button"
                            disabled={alreadyListed}
                            onClick={() => replaceInventoryItem(item)}
                            className={isExpired ? 'kw-card-action kw-card-action-replace' : 'kw-card-action kw-card-action-date'}
                          >
                            {alreadyListed ? 'On list' : isExpired ? 'Replace item' : 'Change date'}
                          </button>
                          <button type="button" onClick={() => removeInventoryItem(item.id)} className="kw-card-delete" aria-label="Delete item">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="kw-card-status">
                          <span className={isExpired ? 'kw-status-text kw-status-expired' : 'kw-status-text kw-status-ok'}>
                            {isExpired ? 'Expired' : item.expiry.label}
                          </span>
                          <span className="kw-card-location">{item.location || 'Kitchen'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : inventoryItems.length > 0 ? (
              <div className="px-4 pb-4">
                <div className="text-center py-6 text-[var(--color-ink-soft)] text-[13px]">
                  <Refrigerator size={24} className="mx-auto mb-2 opacity-50" />
                  <p>All items are fresh!</p>
                </div>
              </div>
            ) : (
              <button type="button" className="today-kitchen-empty" onClick={() => goTo("groceries")}>
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
            <button type="button" onClick={() => goTo("groceries")} className="w-full px-4 py-3 text-left text-[12px] font-semibold text-[var(--color-accent-strong)] border-t border-[var(--color-border)]">
              Open kitchen inventory →
            </button>
          </Card>
        </section>
        <section className={`today-bento-schedule ${editingDashboard ? "is-customizing" : ""}`} style={dashboardPosition("schedule")} {...dashboardDragProps("schedule")}>
          {moveHandle("schedule")}
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
              <EmptyState title="Nothing on the books" subtitle="Add something from the Calendar tab when real life inevitably happens." />
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
                          <span>{formatTime(ev.start)}</span>
                          {ev.end && <small>{formatTime(ev.end)}</small>}
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
          <Card className={`today-meals-card p-4 ${editingDashboard ? "is-customizing" : ""}`} style={dashboardPosition("meals")} {...dashboardDragProps("meals")}>
            {moveHandle("meals")}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">Meals</p>
                <h2 className="ui-section-title">Meal plan</h2>
              </div>
              <button onClick={() => goTo("meals")} className="text-[13px] font-semibold text-[var(--color-accent)] flex items-center gap-0.5">
                Meal planner <ChevronRight size={14} />
              </button>
            </div>
            <div className="today-daily-meals">
              {TODAY_MEAL_SLOTS.map(({ id: slot, label, icon: SlotIcon }) => {
                const meal = meals.find((m) => m.date === today && m.slot === slot && m.title);
                const adder = meal?.createdBy ? memberById[meal.createdBy] : null;
                const openIdeas = () => {
                  try { window.sessionStorage.setItem("famos:meal-ideas-intent:v1", JSON.stringify({ date: today, slot })); } catch { /* private mode */ }
                  goTo("meals");
                };
                const openCook = () => {
                  try { window.sessionStorage.setItem("famos:cook-intent:v1", meal.id || `${today}:${slot}`); } catch { /* private mode */ }
                  goTo("meals");
                };
                return (
                  <article key={slot} className={`today-daily-meal ${meal ? "is-planned" : "is-open"}`}>
                    <span className="today-daily-meal-icon"><SlotIcon size={16} /></span>
                    <div className="today-daily-meal-copy">
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
                    <div className={`today-daily-meal-actions ${meal ? "is-single" : ""}`}>
                      {meal ? (
                        <button type="button" className="cook" onClick={openCook}><ChefHat size={14} /> Cook</button>
                      ) : (
                        <>
                          <button type="button" className="ideas" onClick={openIdeas}><Sparkles size={14} /> Meal ideas</button>
                          <button type="button" onClick={() => goTo("meals")}><CalendarPlus size={14} /> Plan</button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </Card>

          <Card className={`today-groceries-card p-4 ${editingDashboard ? "is-customizing" : ""}`} style={dashboardPosition("groceries")} {...dashboardDragProps("groceries")}>
            {moveHandle("groceries")}
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
              <EmptyState title="Grocery list is clear" subtitle="Nothing to pick up right now. Suspicious, but lovely." />
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {groceryCategories.slice(0, 4).map(([category, count]) => (
                    <span key={category} className="today-category-chip inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-good)]">{category} · {count}</span>
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {activeGroceries.slice(0, 6).map((item) => (
                    <div key={item.id} className="today-list-item rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
                      <p className="text-[13px] font-semibold text-[var(--color-ink)] truncate">{item.name}</p>
                      <p className="text-[11.5px] text-[var(--color-ink-soft)]">{item.category || "Other"}{item.quantity ? ` · ${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : ""}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </section>

        <section className={`today-bento-tasks ${editingDashboard ? "is-customizing" : ""}`} style={dashboardPosition("tasks")} {...dashboardDragProps("tasks")}>
          {moveHandle("tasks")}
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
                <EmptyState title={taskLists.length ? "Your lists are clear" : "No tasks yet"} subtitle={taskLists.length ? "Nothing open right now." : "Create a list for the things your family keeps passing around."} />
              </div>
            ) : (
              <ul className="grid md:grid-cols-2 gap-2">
                {homeTasks.map((t) => {
                  const assignee = memberById[t.assigneeId];
                  const taskAdder = t.createdBy ? memberById[t.createdBy] : null;
                  const taskList = taskLists.find((list) => list.id === t.listId);
                  return (
                    <li key={t.id} className="today-list-item flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                      <Checkbox checked={t.done} onChange={() => toggleTask(t.id)} color={assignee?.color} />
                      <div className="flex-1 min-w-0">
                        <span className={`block text-[14px] ${t.done ? "line-through text-[var(--color-ink-faint)]" : "text-[var(--color-ink)]"} truncate`}>{t.title}</span>
                        <small className="today-task-meta">{[taskList?.name, t.due === today ? "Today" : t.due ? new Date(`${t.due}T12:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" }) : "No due date"].filter(Boolean).join(" · ")}</small>
                        {taskAdder && <Avatar member={taskAdder} size="xs" className="ml-1 mt-0.5" aria-label={`Added by ${taskAdder.name}`} />}
                      </div>
                      {assignee && <Avatar member={assignee} size="sm" />}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
        <section className={`today-bento-messages ${editingDashboard ? "is-customizing" : ""}`} aria-labelledby="latest-family-messages" style={dashboardPosition("messages")} {...dashboardDragProps("messages")}>
          {moveHandle("messages")}
          <Card className="today-messages-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">Family chat</p><h2 id="latest-family-messages" className="ui-section-title">Latest messages</h2></div>
              <button onClick={() => goTo("chat")} className="text-[13px] font-semibold text-[var(--color-accent)] flex items-center gap-0.5">Open chat <ChevronRight size={14}/></button>
            </div>
            {latestMessages.length ? <div className="today-message-list">{latestMessages.map((message) => {
              const sender = memberById[message.senderId];
              const direct = Boolean(message.recipientId);
              return <button type="button" key={message.id} onClick={() => goTo("chat")}><Avatar member={sender || { name: "Family" }} size="sm"/><span><strong>{sender?.name || "Family member"}{direct ? " · Direct" : ""}</strong><small>{message.text}</small></span><time>{new Date(message.sentAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></button>;
            })}</div> : <button type="button" className="today-message-empty" onClick={() => goTo("chat")}><MessageCircle size={18}/><span><strong>The family chat is quiet</strong><small>Start a conversation without turning it into a broadcast.</small></span></button>}
          </Card>
        </section>
      </div>
    </div>
    </PullToRefresh>
  );
}
