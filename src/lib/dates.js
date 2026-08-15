export function todayISO() {
  return dateToISO(new Date());
}

export function dateToISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

export function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return "";
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (Number.isNaN(ms) || ms <= 0) return "";
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
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
  if (h >= 5 && h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Returns { text, icon } where icon is "sun" for daytime, "moon" for evening/night
export function greetingInfo() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { text: "Good morning", icon: "sun" };
  if (h < 17) return { text: "Good afternoon", icon: "sun" };
  return { text: "Good evening", icon: "moon" };
}

export function fullDateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

const dailyEncouragements = [
  "FamOS remembered the plan, so your brain doesn’t have to.",
  "One shared plan. Approximately twelve fewer “wait, what?” texts.",
  "The family circus has a clipboard now.",
  "Tiny check-ins today, fewer plot twists tonight.",
  "You bring the people. FamOS will hold the moving pieces.",
  "Today’s forecast: organized with a chance of snacks.",
  "A visible plan is basically household telepathy.",
  "Keeping everyone in sync—without becoming the family switchboard.",
  "Less remembering. More being there. Excellent trade.",
  "The plan is here. The missing shoe remains a separate investigation.",
  "A few taps now can prevent a kitchen-table summit later.",
  "Family life: delightfully chaotic, slightly more coordinated.",
];

export function dailyEncouragement(dateStr = todayISO()) {
  const index = [...dateStr].reduce((sum, char) => sum + char.charCodeAt(0), 0) % dailyEncouragements.length;
  return dailyEncouragements[index];
}
