// Deterministic natural-language helpers for the Fam AI intent router.
// Everything here is regex/keyword-based on purpose — the whole point of
// Fam AI is to resolve as much as possible WITHOUT an LLM call. These
// helpers are small, testable, and never fetch or call out.

import { addDays, dateToISO } from "../dates";

const WEEKDAYS = [
  { name: "sunday", index: 0 },
  { name: "monday", index: 1 },
  { name: "tuesday", index: 2 },
  { name: "wednesday", index: 3 },
  { name: "thursday", index: 4 },
  { name: "friday", index: 5 },
  { name: "saturday", index: 6 },
];

// "saturday", "next friday", "this weekend", "tomorrow", "today", "monday"
export function parseDate(text, now = new Date()) {
  const lower = text.toLowerCase();
  const today = dateToISO(now);
  if (/\b(tonight|today)\b/.test(lower)) return { date: today, label: "today" };
  if (/\btomorrow\b/.test(lower)) return { date: addDays(today, 1), label: "tomorrow" };
  if (/\bday after tomorrow\b/.test(lower)) return { date: addDays(today, 2), label: "the day after tomorrow" };

  const weekend = /\bthis weekend\b|\bweekend\b/.test(lower);
  if (weekend) {
    const nowDay = now.getDay();
    // Saturday of the current or upcoming weekend
    const daysToSat = (6 - nowDay + 7) % 7;
    return { date: addDays(today, daysToSat === 0 ? 0 : daysToSat), label: "this weekend" };
  }

  for (const day of WEEKDAYS) {
    const next = /\bnext\s+/.test(lower);
    if (new RegExp(`\\b${next ? "next " : ""}${day.name}\\b`).test(lower)) {
      const current = now.getDay();
      let delta = (day.index - current + 7) % 7;
      if (delta === 0) delta = next ? 7 : 0;
      if (next && delta <= 0) delta += 7;
      return { date: addDays(today, delta), label: day.name };
    }
  }

  const iso = lower.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return { date: iso[1], label: iso[1] };

  return null;
}

// "at 10", "at 6:30", "10am", "5:30 PM", "at noon", "7pm"
export function parseTime(text) {
  const lower = text.toLowerCase();
  const noon = /\b(?:at\s+)?noon\b/.test(lower);
  if (noon) return { hour: 12, minute: 0, label: "noon" };
  const m = lower.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\b/);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const meridiem = (m[3] || "").replace(/\./g, "").toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  // If no meridiem and the hour is clearly afternoon (>=5), assume pm — but
  // only when the token is a standalone time (e.g. "at 6", "at 10").
  const at = /\bat\b/.test(lower);
  if (!meridiem && at && hour >= 5 && hour < 12) hour += 12;
  return { hour, minute, label: `${hour % 12 || 12}:${String(minute).padStart(2, "0")}${meridiem || (hour >= 12 ? "pm" : "am")}` };
}

export function isoFromParts(date, time) {
  if (!date) return null;
  const t = time || { hour: 9, minute: 0 };
  return `${date}T${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}:00`;
}

// Extract a list of grocery items from natural text.
// "add milk, bananas, bread and eggs" -> ["milk","bananas","bread","eggs"]
export function parseItems(text) {
  const cleaned = text
    .replace(/\b(add|need|get|buy|put|include|please|to|the|we're out of|we are out of|out of|on)\b/gi, " ")
    .replace(/[.,;!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  const parts = cleaned
    .split(/\s+(?:and|&|plus)\s+|\s*,\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
  // Also split on "some" / "a" determiners that lead into the item name
  return parts
    .flatMap((part) => part.split(/\s+(?:some|a few)\s+/))
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

// Best-effort quantity + unit extraction for a grocery item phrase.
export function parseQuantity(phrase) {
  const m = phrase.toLowerCase().match(/^(?:(\d+(?:\.\d+)?)\s*(kg|g|lb|lbs|oz|ml|l|bottle|bottles|bag|bags|box|boxes|can|cans|pack|packs|loaf|loaves|carton|cartons|bunch|dozen|tbsp|tsp|cup|cups))?\s*(.+)$/);
  if (!m) return { name: phrase.trim(), quantity: 1, unit: "" };
  return {
    name: (m[3] || phrase).trim(),
    quantity: m[1] ? parseFloat(m[1]) : 1,
    unit: m[2] || "",
  };
}

// Match a member name against the household roster. Returns { id, name } or null.
export function findMember(text, members = []) {
  if (!members.length) return null;
  const lower = text.toLowerCase();
  // Exact name match first (whole word), then first-name prefix match.
  for (const member of members) {
    const name = (member.name || "").toLowerCase();
    if (!name) continue;
    if (new RegExp(`\\b${escapeRegex(name)}\\b`).test(lower)) {
      return { id: member.id, name: member.name };
    }
  }
  for (const member of members) {
    const name = (member.name || "").toLowerCase();
    if (!name) continue;
    const first = name.split(/\s+/)[0];
    if (first.length > 2 && new RegExp(`\\b${escapeRegex(first)}\\b`).test(lower)) {
      return { id: member.id, name: member.name };
    }
  }
  return null;
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Strip known fillers so remaining text is the "payload" (event title, task).
export function stripFillers(text) {
  return text
    .replace(/\b(please|pls|thanks|thank you|hey|hi|hello|can you|could you|would you|i want to|i'd like to|i need to|remember to|don't forget to|dont forget to|remind me to)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
