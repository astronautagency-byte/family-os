import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChefHat, ChevronRight, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Clock3, Droplets, Home, ListChecks, MapPin, Megaphone, Moon, ShoppingCart, Sparkles, Sun, TriangleAlert, Users, Wind, X } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { BROADCAST_REACTIONS, useFamily } from "../context/FamilyContext";
import { useAuth } from "../context/AuthContext";
import { Avatar, AvatarStack, Card, Checkbox, EmptyState, Tag, colorVar } from "../components/ui";
import PageHeader from "../components/PageHeader";
import { supabase } from "../lib/supabase";
import { addDays, dailyEncouragement, formatDayLabel, formatTime, fullDateLabel, greetingInfo, todayISO } from "../lib/dates";

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
const dayLabel = (date) => {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString(undefined, { weekday: "short" });
};
const roundTemp = (value) => (Number.isFinite(Number(value)) ? Math.round(Number(value)) : "—");

function BroadcastBanner({ item, sender, reactions, currentUserId, onReact, onClear }) {
  const ref = useRef(null);
  useGSAP(() => {
    if (!ref.current) return undefined;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(ref.current, { autoAlpha: 0, y: -16, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.55, ease: "back.out(1.7)" });
    });
    return () => media.revert();
  }, { scope: ref });

  return (
    <div className="broadcast-banner" ref={ref}>
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

function percent(part, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function MiniMetric({ icon: Icon, label, value, note, tone = "accent", onClick }) {
  const toneClass = {
    accent: "text-[var(--color-accent)]",
    good: "text-[var(--color-good)]",
    warn: "text-[var(--color-warn)]",
    rose: "text-[var(--color-fam-rose)]",
  }[tone] || "text-[var(--color-accent)]";
  const body = (
    <Card className={`today-metric-card today-metric-${tone} p-4 h-full active:scale-[0.99] transition-transform`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-white border border-[var(--color-border)] ${toneClass}`}>
          <Icon size={19} />
        </span>
        {onClick && <ChevronRight size={17} color="var(--color-ink-faint)" />}
      </div>
      <p className="mt-4 text-[26px] leading-none font-[var(--font-display)] font-semibold tracking-[-0.04em] text-[var(--color-ink)]">{value}</p>
      <p className="mt-1 text-[12px] font-semibold text-[var(--color-ink)]">{label}</p>
      {note && <p className="mt-1 text-[11.5px] leading-snug text-[var(--color-ink-soft)]">{note}</p>}
    </Card>
  );
  return onClick ? <button onClick={onClick} className="text-left w-full h-full">{body}</button> : body;
}

function ProgressLine({ label, value, total, color = "var(--color-accent)" }) {
  const progress = percent(value, total);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[12px] mb-1.5">
        <span className="font-medium text-[var(--color-ink)]">{label}</span>
        <span className="tabular-nums text-[var(--color-ink-soft)]">{value}/{total}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function Today({ goTo }) {
  const { members, memberById, events, googleEvents, feedEvents, meals, tasks, groceries, toggleTask, tabletMode, broadcasts, broadcastMessage, clearBroadcast, reactionsByMessage, reactToBroadcast, currentUserId } = useFamily();
  const { profile, user, householdProfileExtra } = useAuth();
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastError, setBroadcastError] = useState("");
  const postBroadcast = async (event) => {
    event.preventDefault();
    if (!broadcastText.trim() || broadcasting) return;
    setBroadcasting(true); setBroadcastError("");
    try { await broadcastMessage(broadcastText.trim()); setBroadcastText(""); }
    catch (error) { setBroadcastError(error.message || "Could not broadcast right now."); }
    finally { setBroadcasting(false); }
  };
  const today = todayISO();
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(today, index));
  const weekEnd = weekDays[weekDays.length - 1];
  const greeting = greetingInfo();
  const allEvents = [...events, ...googleEvents, ...feedEvents];

  const todaysEvents = allEvents
    .filter((e) => e.start.slice(0, 10) === today)
    .sort((a, b) => a.start.localeCompare(b.start));
  const weekEvents = allEvents
    .filter((e) => {
      const date = e.start?.slice(0, 10);
      return date >= today && date <= weekEnd;
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  const dinner = meals.find((m) => m.date === today && m.slot === "dinner");
  const weekDinners = weekDays.map((date) => meals.find((m) => m.date === date && m.slot === "dinner" && m.title)).filter(Boolean);

  const todaysTasks = tasks
    .filter((t) => t.due === today)
    .sort((a, b) => Number(a.done) - Number(b.done));
  const openTaskCount = todaysTasks.filter((t) => !t.done).length;
  const weekTasks = tasks.filter((t) => t.due >= today && t.due <= weekEnd);
  const weekDoneTasks = weekTasks.filter((t) => t.done);

  const activeGroceries = groceries.filter((g) => !g.checked);
  const groceryCount = activeGroceries.length;
  const groceryCategories = Object.entries(
    activeGroceries.reduce((acc, item) => {
      const category = item.category || "Other";
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const memberStats = members.map((member) => {
    const memberTasks = weekTasks.filter((task) => task.assigneeId === member.id);
    const memberEvents = weekEvents.filter((event) => (event.memberIds || []).includes(member.id));
    return {
      member,
      tasksTotal: memberTasks.length,
      tasksOpen: memberTasks.filter((task) => !task.done).length,
      events: memberEvents.length,
      load: memberTasks.filter((task) => !task.done).length + memberEvents.length,
    };
  }).sort((a, b) => b.load - a.load);

  const busiestDay = weekDays
    .map((date) => ({
      date,
      count: weekEvents.filter((event) => event.start.slice(0, 10) === date).length + weekTasks.filter((task) => task.due === date && !task.done).length,
    }))
    .sort((a, b) => b.count - a.count)[0];
  const mealCoverage = percent(weekDinners.length, 7);

  const nextEvent = todaysEvents.find((e) => new Date(e.end) > new Date());
  const todayBrief = [
    todaysEvents.length ? `${todaysEvents.length} event${todaysEvents.length === 1 ? "" : "s"}` : "No events",
    openTaskCount ? `${openTaskCount} task${openTaskCount === 1 ? "" : "s"} left` : "Tasks clear",
    dinner?.title ? "Dinner sorted" : "Dinner open",
    groceryCount ? `${groceryCount} groceries` : "List clear",
  ];
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

  useEffect(() => {
    if (!hasWeatherLocation) {
      setWeather(null);
      return undefined;
    }
    const controller = new AbortController();
    let cancelled = false;

    // Keyless fallback (Open-Meteo) — used when the weatherapi edge function isn't
    // deployed or fails. Normalised to the same shape as the edge function payload.
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

    const run = async () => {
      try {
        if (supabase) {
          const { data, error } = await supabase.functions.invoke("weather", { body: { latitude, longitude, days: 3 } });
          if (!error && data && !data.error && data.current) {
            if (!cancelled) { setWeather(data); setWeatherError(""); }
            return;
          }
        }
        const fallback = await fromOpenMeteo();
        if (!cancelled) { setWeather(fallback); setWeatherError(""); }
      } catch (error) {
        if (cancelled || error?.name === "AbortError") return;
        try {
          const fallback = await fromOpenMeteo();
          if (!cancelled) { setWeather(fallback); setWeatherError(""); }
        } catch (fallbackError) {
          if (!cancelled && fallbackError?.name !== "AbortError") setWeatherError(fallbackError.message || "Weather is unavailable.");
        }
      }
    };
    run();
    return () => { cancelled = true; controller.abort(); };
  }, [hasWeatherLocation, latitude, longitude]);

  const weatherNow = weather?.current;
  const weatherRisk = weatherNow && (weatherNow.rainChance >= 50 || weatherNow.windKph >= 40);
  const disruptedEvents = weatherRisk ? todaysEvents.filter((event) => event.location) : [];

  return (
    <div className="pb-24 reference-dashboard">
      <PageHeader
        eyebrow={fullDateLabel(today)}
        title={tabletMode ? `${greetingLabel}, family` : `${greetingLabel}${greetingName ? `, ${greetingName}` : ""}`}
        subtitle={dailyEncouragement(today)}
        illustration="home"
      />

      <div className="px-5 space-y-6 mt-2">
        <section className="broadcast-home" aria-label="Family broadcast">
          <form className="broadcast-compose" onSubmit={postBroadcast}>
            <span className="broadcast-compose-icon"><Megaphone size={18} /></span>
            <input
              value={broadcastText}
              onChange={(event) => setBroadcastText(event.target.value)}
              placeholder="Broadcast a note to everyone’s home screen…"
              aria-label="Broadcast a message to the family"
            />
            <button type="submit" disabled={!broadcastText.trim() || broadcasting}>{broadcasting ? "Sending…" : "Broadcast"}</button>
          </form>
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
        <Card className="weather-now-card p-4">
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
          <div className="weather-now-main">
            <span className={`weather-now-glyph ${weatherRisk ? "risk" : ""}`}>{weatherNow ? <WeatherGlyph kind={weatherNow.kind} isDay={weatherNow.isDay} size={24} /> : <Sun size={24} />}</span>
            <div>
              <strong>{weatherNow ? `${roundTemp(weatherNow.tempC)}°` : "Local weather"}</strong>
              <small>{weatherNow ? `${conditionLabel(weatherNow)} · ${weather?.location?.name || householdProfileExtra?.city || householdProfileExtra?.address || "Your area"}` : householdProfileExtra?.city || householdProfileExtra?.address || "Add your home address"}</small>
            </div>
            {weatherNow && <p><Droplets size={13} /> {weatherNow.rainChance}% · Feels {roundTemp(weatherNow.feelsLikeC)}° · <Wind size={13} /> {Math.round(weatherNow.windKph)} km/h</p>}
          </div>
          {weather?.daily?.length > 0 && (
            <div className="weather-daily" aria-label="3-day forecast">
              {weather.daily.map((day, index) => (
                <div className="weather-day" key={day.date}>
                  <span className="weather-day-label">{index === 0 ? "Today" : dayLabel(day.date)}</span>
                  <WeatherGlyph kind={day.kind} isDay size={18} />
                  <span className={`weather-day-rain ${day.rainChance >= 30 ? "wet" : ""}`}><Droplets size={11} /> {day.rainChance}%</span>
                  <span className="weather-day-temps"><strong>{roundTemp(day.maxC)}°</strong> <em>{roundTemp(day.minC)}°</em></span>
                </div>
              ))}
            </div>
          )}
          {!hasWeatherLocation && <button onClick={() => goTo("settings")} className="weather-address-action"><MapPin size={16} /><span><strong>Add an address to turn on weather</strong><small>FamOS will also flag today’s location-based events when weather may disrupt them.</small></span><ChevronRight size={16} /></button>}
          {disruptedEvents.length > 0 && <button onClick={() => goTo("calendar")} className="weather-event-warning"><CloudRain size={16} /><span><strong>Weather may affect {disruptedEvents.length} event{disruptedEvents.length === 1 ? "" : "s"} today</strong><small>{disruptedEvents.map((event) => event.title).join(", ")}</small></span><ChevronRight size={16} /></button>}
          {weatherError && <small className="address-autocomplete-warning">{weatherError}</small>}
        </Card>
        <section className="m3-grid grid-cols-2 lg:grid-cols-4">
          <MiniMetric icon={CalendarDays} label="Calendar today" value={todaysEvents.length} note={nextEvent ? `Next: ${formatTime(nextEvent.start)}` : "Beautifully empty"} onClick={() => goTo("calendar")} />
          <MiniMetric icon={ListChecks} label="Open tasks" value={openTaskCount} note={openTaskCount ? "A few tiny missions remain" : "Nothing due today"} tone="rose" onClick={() => goTo("tasks")} />
          <MiniMetric icon={ChefHat} label="Dinners this week" value={`${weekDinners.length}/7`} note={`${mealCoverage}% of dinner drama avoided`} tone="warn" onClick={() => goTo("meals")} />
          <MiniMetric icon={ShoppingCart} label="Grocery list" value={groceryCount} note={groceryCategories[0] ? `${groceryCategories[0][0]} needs a look` : "List is clear"} tone="good" onClick={() => goTo("groceries")} />
        </section>

        <section className="m3-grid lg:grid-cols-[1.15fr_.85fr]">
          <Card className="today-command-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-accent-strong)]">Today, sorted</p>
                <h2 className="mt-2 font-[var(--font-display)] text-[28px] leading-[1.02] font-semibold tracking-[-0.045em] text-[var(--color-ink)]">
                  {nextEvent ? "Today at a glance" : "Today is clear"}
                </h2>
              </div>
              <span className="w-12 h-12 rounded-2xl bg-white border border-[var(--color-border)] flex items-center justify-center shrink-0">
                <Home size={22} color="var(--color-accent)" />
              </span>
            </div>
            <div className="grid sm:grid-cols-4 gap-2 mt-5">
              {todayBrief.map((item) => (
                <div key={item} className="rounded-2xl bg-white border border-[var(--color-border)] px-3 py-2 text-[12px] font-semibold text-[var(--color-ink)]">
                  {item}
                </div>
              ))}
            </div>
            {nextEvent ? (
              <button onClick={() => goTo("calendar")} className="mt-5 w-full text-left rounded-2xl bg-white border border-[var(--color-border)] p-4 flex items-center gap-3 active:scale-[0.99] transition-transform">
                <span className="w-11 h-11 rounded-2xl bg-white border border-[var(--color-border)] text-[var(--color-accent)] flex items-center justify-center shrink-0">
                  <Clock3 size={20} />
                </span>
                <span className="flex-1 min-w-0">
                  <small className="block text-[11px] font-bold uppercase tracking-wide text-[var(--color-accent-strong)]">Up next · {formatTime(nextEvent.start)}</small>
                  <strong className="block text-[15px] text-[var(--color-ink)] truncate">{nextEvent.title}</strong>
                  {nextEvent.location && <em className="not-italic text-[12.5px] text-[var(--color-ink-soft)] flex items-center gap-1 mt-0.5"><MapPin size={11} /> {nextEvent.location}</em>}
                </span>
                <AvatarStack members={(nextEvent.memberIds || []).map((id) => memberById[id]).filter(Boolean)} />
              </button>
            ) : (
              <p className="mt-5 rounded-2xl bg-white border border-[var(--color-border)] p-4 text-[14px] text-[var(--color-ink-soft)]">Nothing urgent on the calendar. Take the win.</p>
            )}
          </Card>

          <Card className="today-pulse-card p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">This week</p>
                <h2 className="ui-section-title">This week</h2>
              </div>
              <span className="w-10 h-10 rounded-2xl bg-white border border-[var(--color-border)] flex items-center justify-center shrink-0">
                <Sparkles size={18} color="var(--color-accent)" />
              </span>
            </div>
            <div className="space-y-4">
              <ProgressLine label="Dinner plan coverage" value={weekDinners.length} total={7} color="var(--color-warn)" />
              <ProgressLine label="Task completion" value={weekDoneTasks.length} total={weekTasks.length || 1} color="var(--color-good)" />
              <div className="rounded-2xl bg-white border border-[var(--color-border)] p-3">
                <p className="text-[12px] font-semibold text-[var(--color-ink)]">Busiest day</p>
                <p className="text-[13px] text-[var(--color-ink-soft)]">{busiestDay?.count ? `${formatDayLabel(busiestDay.date)} has ${busiestDay.count} moving piece${busiestDay.count === 1 ? "" : "s"}.` : "No heavy days in the next week."}</p>
              </div>
            </div>
          </Card>
        </section>

        <section className="m3-grid lg:grid-cols-3">
          <Card className="today-flow-card p-4 lg:col-span-2">
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
              <ol className="divide-y divide-[var(--color-border)]">
                {todaysEvents.slice(0, 5).map((ev) => {
                  const evMembers = (ev.memberIds || []).map((id) => memberById[id]).filter(Boolean);
                  const isPast = new Date(ev.end) < new Date();
                  const isExternal = ev.source !== "local";
                  const dotColor = isExternal ? (ev.color || "#4C91F2") : evMembers[0] ? colorVar(evMembers[0].color) : "var(--color-accent)";
                  return (
                    <li key={ev.id} className={`flex items-center gap-3 py-3 ${isPast ? "opacity-50" : ""}`}>
                      <span className="w-16 shrink-0 text-[12.5px] font-semibold tabular-nums text-[var(--color-ink-soft)]">{formatTime(ev.start)}</span>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                      <span className="flex-1 min-w-0">
                        <strong className="block text-[14px] text-[var(--color-ink)] truncate">{ev.title}</strong>
                        {ev.location && <small className="text-[12px] text-[var(--color-ink-soft)] truncate flex items-center gap-1"><MapPin size={11} /> {ev.location}</small>}
                      </span>
                      <AvatarStack members={evMembers} size="sm" />
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <Card className="today-load-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">Family load</p>
                <h2 className="ui-section-title">Family workload</h2>
              </div>
              <Users size={18} color="var(--color-accent)" />
            </div>
            <div className="space-y-3">
              {memberStats.length === 0 ? (
                <EmptyState title="No members yet" subtitle="Invite your family from Settings." />
              ) : memberStats.map(({ member, tasksOpen, events }) => (
                <div key={member.id} className="flex items-center gap-3">
                  <Avatar member={member} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--color-ink)] truncate">{member.name}</p>
                    <p className="text-[11.5px] text-[var(--color-ink-soft)]">{events} events · {tasksOpen} open tasks</p>
                  </div>
                  <div className="w-20 h-1.5 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min((tasksOpen + events) * 18, 100)}%`, backgroundColor: colorVar(member.color) }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="m3-grid lg:grid-cols-2">
          <Card className="today-meals-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">Meals</p>
                <h2 className="ui-section-title">Meal plan</h2>
              </div>
              <button onClick={() => goTo("meals")} className="text-[13px] font-semibold text-[var(--color-accent)] flex items-center gap-0.5">
                Meal planner <ChevronRight size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {weekDays.slice(0, 5).map((date) => {
                const meal = meals.find((m) => m.date === date && m.slot === "dinner" && m.title);
                return (
                  <div key={date} className="flex items-center gap-3 rounded-2xl bg-white border border-[var(--color-border)] px-3 py-2.5">
                    <span className="w-12 shrink-0 text-[11.5px] font-bold uppercase text-[var(--color-accent-strong)]">{date === today ? "Today" : formatDayLabel(date, { withWeekday: true }).split(",")[0]}</span>
                    <span className="flex-1 text-[13px] text-[var(--color-ink)] truncate">{meal?.title || "Open dinner slot"}</span>
                    {meal?.cookIds?.length ? <AvatarStack members={meal.cookIds.map((id) => memberById[id]).filter(Boolean)} size="sm" /> : <Tag tone="neutral">Plan</Tag>}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="today-groceries-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">Groceries</p>
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
                    <span key={category} className="today-category-chip inline-flex items-center rounded-full border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--color-good)]">{category} · {count}</span>
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {activeGroceries.slice(0, 6).map((item) => (
                    <div key={item.id} className="today-list-item rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2.5">
                      <p className="text-[13px] font-semibold text-[var(--color-ink)] truncate">{item.name}</p>
                      <p className="text-[11.5px] text-[var(--color-ink-soft)]">{item.category || "Other"}{item.quantity ? ` · ${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : ""}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </section>

        <section>
          <Card className="today-tasks-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">Tasks</p>
                <h2 className="ui-section-title">Today’s tasks</h2>
              </div>
              <button onClick={() => goTo("tasks")} className="text-[13px] font-semibold text-[var(--color-accent)] flex items-center gap-0.5">
                View tasks <ChevronRight size={14} />
              </button>
            </div>
            {todaysTasks.length === 0 ? (
              <div className="today-compact-empty">
                <EmptyState title="No tasks due today" subtitle="You’re all caught up." />
              </div>
            ) : (
              <ul className="grid md:grid-cols-2 gap-2">
                {todaysTasks.map((t) => {
                  const assignee = memberById[t.assigneeId];
                  return (
                    <li key={t.id} className="today-list-item flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white border border-[var(--color-border)]">
                      <Checkbox checked={t.done} onChange={() => toggleTask(t.id)} color={assignee?.color} />
                      <span className={`flex-1 text-[14px] ${t.done ? "line-through text-[var(--color-ink-faint)]" : "text-[var(--color-ink)]"}`}>
                        {t.title}
                      </span>
                      {assignee && <Avatar member={assignee} size="sm" />}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
