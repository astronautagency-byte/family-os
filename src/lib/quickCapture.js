// Parse a single free-form "quick add" line into a structured event/task draft.
// Best-effort, never throws, never silently drops the user's input —
// if a field is left ambiguous, it falls back to a sensible default and
// flags `inferredDate` / `inferredTime` so callers can show "did you mean…?"

const WEEKDAY_SHORT = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEKDAY_LONG_TO_SHORT = {
  sunday: "sun", monday: "mon", tuesday: "tue", wednesday: "wed",
  thursday: "thu", friday: "fri", saturday: "sat",
};

const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addMinutes = (hhmm, add) => {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + add + 24 * 60) % (24 * 60);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

function nextWeekday(shortName, forceNext, from = new Date()) {
  const target = WEEKDAY_SHORT.indexOf(String(shortName).slice(0, 3).toLowerCase());
  if (target < 0) return null;
  const today = from.getDay();
  let delta = (target - today + 7) % 7;
  if (forceNext) delta = delta === 0 ? 7 : delta;
  if (delta === 0 && !forceNext) return null; // today — caller decides
  const d = new Date(from);
  d.setDate(d.getDate() + delta);
  return d;
}

// Decide AM/PM for hours 1..12 when no meridiem was typed. Bias toward
// after-school family events (the modal's natural default), but keep mornings
// and very-late-evening hours as written.
function disambiguateHour(h, hasMeridiem) {
  if (hasMeridiem) return h;
  if (h >= 13 && h <= 23) return h;        // 24h already explicit
  if (h === 0 || h === 12) return h === 0 ? 0 : 12; // treat <12:> as noon
  if (h >= 1 && h <= 6) return h + 12;     // 1-6 → 13-18 (afternoon)
  return h;                                // 7-11 → morning
}

function titleCase(word) {
  if (!word) return word;
  if (word.length >= 2 && word === word.toUpperCase() && /[A-Z]/.test(word)) return word;
  if (/^[A-Z]/.test(word)) return word;
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Parse a "quick add" line into an event draft.
 *
 * @param {string} input  raw text from the user
 * @param {string} anchorDate  ISO YYYY-MM-DD — fallback when no date token is parsed
 * @returns {{
 *   raw: string,
 *   title: string,
 *   date: string,
 *   start: string,
 *   end: string,
 *   hasTime: boolean,
 *   hasDate: boolean,
 *   inferredDate: boolean,
 *   inferredTime: boolean,
 * }}
 */
export function parseQuickAdd(input, anchorDate) {
  const raw = String(input ?? "").trim();
  const anchor = anchorDate || isoDate(new Date());
  const result = {
    raw,
    title: "",
    date: anchor,
    start: "18:00",
    end: "19:00",
    hasTime: false,
    hasDate: false,
    inferredDate: false,
    inferredTime: false,
  };
  if (!raw) return result;

  let working = raw.replace(/\s+/g, " ");

  // ── DATE ──────────────────────────────────────────────────────────────────
  let date = anchor;
  let hasDate = false;

  // numeric — `12/15`, `12-15`, `12/15/26`, `12-15-26`
  const slash = working.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (slash) {
    const mm = Number(slash[1]);
    const dd = Number(slash[2]);
    const yrRaw = slash[3];
    const yr = yrRaw
      ? (yrRaw.length === 2 ? 2000 + Number(yrRaw) : Number(yrRaw))
      : new Date().getFullYear();
    const d = new Date(yr, mm - 1, dd);
    if (!Number.isNaN(d.getTime()) && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      date = isoDate(d);
      hasDate = true;
      working = working.replace(slash[0], "");
    }
  }

  // today / tonight
  if (!hasDate) {
    const tdy = working.match(/\b(today|tonight)\b/i);
    if (tdy) {
      date = isoDate(new Date());
      hasDate = true;
      working = working.replace(tdy[0], "");
    }
  }

  // tomorrow
  if (!hasDate) {
    const tmrw = working.match(/\btomorrow\b/i);
    if (tmrw) {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      date = isoDate(t);
      hasDate = true;
      working = working.replace(tmrw[0], "");
    }
  }

  // weekday name (Sun..Sat or full), optionally prefixed "next"
  if (!hasDate) {
    const day = working.match(
      /\b(next\s+|this\s+)?(sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i
    );
    if (day) {
      const forceNext = !!day[1];
      const key = (WEEKDAY_LONG_TO_SHORT[day[2].toLowerCase()] || day[2].toLowerCase()).slice(0, 3);
      const d = nextWeekday(key, forceNext);
      if (d) {
        date = isoDate(d);
        hasDate = true;
        working = working.replace(day[0], "");
      }
    }
  }

  // ── TIME ──────────────────────────────────────────────────────────────────
  let start = "18:00";
  let end = "19:00";
  let hasTime = false;

  // noon / midnight win over numeric fallbacks
  const noonMidnight = working.match(/\b(noon|midnight)\b/i);
  if (noonMidnight) {
    start = noonMidnight[0].toLowerCase() === "noon" ? "12:00" : "00:00";
    end = addMinutes(start, 60);
    hasTime = true;
    working = working.replace(noonMidnight[0], "");
  }

  // numeric time — take the FIRST plausible token
  if (!hasTime) {
    const timeTokens = working.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?\b/g) || [];
    for (const token of timeTokens) {
      const m = token.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?$/);
      if (!m) continue;
      let h = Number(m[1]);
      const mm = Number(m[2] ?? 0);
      const mer = (m[3] || "").toLowerCase();
      if (Number.isNaN(h) || h < 0 || h > 23 || mm < 0 || mm > 59) continue;
      h = disambiguateHour(h, !!mer);
      start = `${pad(h)}:${pad(mm)}`;
      end = addMinutes(start, 60);
      hasTime = true;
      working = working.replace(token, "");
      break;
    }
  }

  // ── TITLE ─────────────────────────────────────────────────────────────────
  // Strip leading/trailing connectors and stray punctuation that the date/time
  // matches left behind. Keep things inside the title (like "Anna's") intact.
  let title = working
    .replace(/^(and|with|at|on|in|to|for)\s+/i, "")
    .replace(/\s+(and|with|at|on|in|to|for)$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[^\w'"]+/, "")
    .replace(/[^\w'"]+$/, "");

  if (!title) {
    // Nothing usable left — fall back to the raw input so the user sees what they typed.
    title = raw;
  } else {
    title = title.split(/\s+/).map(titleCase).join(" ");
  }

  result.title = title;
  result.date = date;
  result.start = start;
  result.end = end;
  result.hasTime = hasTime;
  result.hasDate = hasDate;
  result.inferredDate = !hasDate;
  result.inferredTime = !hasTime;
  return result;
}
