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
  "You’ve got enough on your plate — let Fam OS hold the plan.",
  "Small bits of coordination count. You’re keeping the rhythm going.",
  "One shared plan is already a calmer day.",
  "You don’t have to remember everything alone today.",
  "A little structure now, a little more ease later.",
  "Your family’s day has a soft place to land.",
  "Keep it simple today — the next right thing is enough.",
  "The house runs better when the plan is visible.",
  "You’re building the kind of calm everyone can feel.",
  "Tiny check-ins can save a dozen group texts.",
  "Today’s goal: fewer loose ends, more breathing room.",
  "You’re doing the quiet work that makes family life flow.",
];

export function dailyEncouragement(dateStr = todayISO()) {
  const index = [...dateStr].reduce((sum, char) => sum + char.charCodeAt(0), 0) % dailyEncouragements.length;
  return dailyEncouragements[index];
}
