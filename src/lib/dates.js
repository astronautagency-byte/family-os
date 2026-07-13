export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function dateToISO(d) {
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return dateToISO(d);
}

export function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDayLabel(dateStr, { withWeekday = true } = {}) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: withWeekday ? "short" : undefined,
    month: "short",
    day: "numeric",
  });
}

export function isSameDayAsToday(dateStr) {
  return dateStr === todayISO();
}

export function greetingForNow() {
  const h = new Date().getHours();
  if (h < 5) return "Still up?";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

// Returns { text, icon } where icon is "sun" for daytime, "moon" for evening/night
export function greetingInfo() {
  const h = new Date().getHours();
  if (h < 5) return { text: "Still up?", icon: "moon" };
  if (h < 12) return { text: "Good morning", icon: "sun" };
  if (h < 17) return { text: "Good afternoon", icon: "sun" };
  if (h < 21) return { text: "Good evening", icon: "moon" };
  return { text: "Good night", icon: "moon" };
}

export function fullDateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}
