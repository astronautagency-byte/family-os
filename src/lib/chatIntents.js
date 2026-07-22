// Lightweight client-side intent detector for chat messages.
// Runs locally so suggestions appear instantly, without an API call —
// the design intent is "a helpful nudge, not an oracle." Patterns are
// intentionally conservative: missing an item beats spamming false
// positives.
//
// Each message produces at most ONE suggestion (highest priority:
// grocery > task > meal > event) to keep the chat calm.

const DAY_WORDS = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|thurs|fri|sat|sun|today|tomorrow|tonight|this weekend|next week|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday)\b/i;
const TIME_PATTERN = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|at\s+\d{1,2}(?::\d{2})?)\b/i;

// Split a phrase into discrete items, dropping leading helpers like "to".
function splitItems(phrase) {
  if (!phrase) return [];
  return phrase
    .split(/\s*(?:,|\band\b|&|\+|\/|;)\s*/i)
    .map((part) => part.replace(/^(?:to|the|some|a|an)\s+/i, "").trim())
    .filter((part) => part.length >= 2 && part.length <= 60);
}

// Build a local datetime string ("YYYY-MM-DDTHH:mm:ss") from a day word + time.
function combineDateTime(day, time) {
  if (!day && !time) return null;
  const now = new Date();
  const target = new Date(now);
  if (day) {
    const lower = day.toLowerCase();
    if (lower === "today") {
      // already `now`
    } else if (lower === "tomorrow") {
      target.setDate(target.getDate() + 1);
    } else if (lower === "tonight") {
      // same day, evening
    } else if (lower === "this weekend") {
      const offset = (6 - target.getDay() + 7) % 7 || 7;
      target.setDate(target.getDate() + offset);
    } else if (lower.startsWith("next ")) {
      const weekdayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      const key = lower.slice(5).slice(0, 3);
      const weekday = weekdayMap[key] ?? target.getDay();
      const offset = ((weekday - target.getDay() + 7) % 7) + 7;
      target.setDate(target.getDate() + offset);
    } else {
      const weekdayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sund: 0, mond: 1, tues: 2, wedn: 3, thur: 4, satur: 6 };
      const key = lower.slice(0, 4);
      const weekday = weekdayMap[key];
      if (weekday != null) {
        const offset = (weekday - target.getDay() + 7) % 7 || 7;
        target.setDate(target.getDate() + offset);
      }
    }
  }
  if (time) {
    const match = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i) || time.match(/at\s+(\d{1,2})(?::(\d{2}))?/i);
    if (match) {
      let hour = parseInt(match[1], 10);
      const minute = match[2] ? parseInt(match[2], 10) : 0;
      const meridiem = (match[3] || "").toLowerCase();
      if (meridiem === "pm" && hour < 12) hour += 12;
      if (meridiem === "am" && hour === 12) hour = 0;
      target.setHours(hour, minute, 0, 0);
    }
  } else if (day === "tonight") {
    target.setHours(19, 0, 0, 0);
  }
  return target.toISOString().slice(0, 19);
}

function detectGrocery(text) {
  // Group A — explicit shortage / need statements.
  const patternA = /^(?:(?:we|i|i'm|im|let's|all|the kids)\s+)?(?:need|out of|running low on|low on|short on|almost out of|almost out|ran out of|ran out|are out of|are out|don't have any more|forgot|forgot to get|forgot to buy)\s+(.+?)\.?$/i;
  const matchA = patternA.exec(text);
  if (matchA) {
    const items = splitItems(matchA[1]);
    if (items.length) return { kind: "grocery", items };
  }
  // Group B — list-append verbs followed by an explicit list target.
  const patternB = /^(?:add|put|grab|buy|get|drop|throw)\s+(.+?)\s+(?:to|on|onto|in(?:to)?)\s+(?:the\s+)?(?:list|grocery list|grocery|shopping list|sheet|next order)\.?$/i;
  const matchB = patternB.exec(text);
  if (matchB) {
    const items = splitItems(matchB[1]);
    if (items.length) return { kind: "grocery", items };
  }
  // Group C — bare pickup verbs ("pick up milk", "grab some bread").
  // Only matches when there's no day/time attached — those belong on the calendar.
  const patternC = /^(?:(?:please|plz|can someone|could someone|let's|lets|maybe we should|we should|i'll|ill|i'm gonna|im gonna|i'm going to|im going to|we're gonna|we're going to|gonna|gotta|need to)\s+)?(?:pick up|pickup|grab|get|buy|pick up some|grab some)\s+(.+?)\.?$/i;
  const matchC = patternC.exec(text);
  if (matchC) {
    const tail = matchC[1];
    // Reject if it has day-of-week or time — that's an event/schedule, not a grocery run.
    if (!DAY_WORDS.test(tail) && !TIME_PATTERN.test(tail)) {
      const items = splitItems(tail);
      if (items.length) return { kind: "grocery", items };
    }
  }
  // Group D — "we should buy milk" / "go get some eggs" — softer hint.
  const patternD = /^(?:we (?:should|need to)|(?:i|let's) (?:should|will|shall)?\s*)?(?:go )?(?:pick up|grab|get|buy|snag)\s+(?:some\s+|a\s+|the\s+)?(.+?)\.?$/i;
  const matchD = patternD.exec(text);
  if (matchD) {
    const tail = matchD[1];
    if (!DAY_WORDS.test(tail) && !TIME_PATTERN.test(tail) && tail.length <= 80) {
      const items = splitItems(tail);
      if (items.length && items[0].length >= 2) return { kind: "grocery", items };
    }
  }
  return null;
}

function detectTask(text) {
  // Reminder + obligation phrases.
  const taskVerbs = /^(?:remind me to|remember to|don't forget to|don't forget|make sure to|make sure|make certain to|i need to|i've gotta|ive gotta|i gotta|i should|i must|i have to|gotta|gotta remember to|i wanna|i want to|need to remember to|todo:?)\s+(.+?)\.?$/i;
  const matchA = taskVerbs.exec(text);
  if (matchA) return buildTaskIntent(matchA[1]);
  // Bare imperative action verbs ("call mom", "pay rent").
  const imperativeVerbs = /^(pick up|pickup|call|email|text|message|reply to|reply|renew|book|book the|book a|schedule|sign|sign the|sign up|sign up for|pay|clean|launder|fix|return|wash|dropoff|drop off|drop by|feed|walk|water|change|charge|fill up|fill|grocery shop|grocery|groceries|set up|setup|test|try|send|submit|file|finish|complete|organize|tidy|sort|pack|unpack|load|unload|charge up|throw out|take out|recycle|return the)\s+(.+?)\.?$/i;
  const matchB = imperativeVerbs.exec(text);
  if (matchB) return buildTaskIntent(`${matchB[1]} ${matchB[2]}`);
  // Polite / hedge imperative: "please X mom", "can you call mom"
  const politeVerbs = /^(?:please|plz|pls)\s+(.+?)\.?$/i;
  const matchC = politeVerbs.exec(text);
  if (matchC && /^[a-z]+\b/i.test(matchC[1])) return buildTaskIntent(matchC[1]);
  return null;
}

function buildTaskIntent(action) {
  let dueFull = null;
  const timeMatch = action.match(TIME_PATTERN);
  const dayMatch = action.match(DAY_WORDS);
  let cleaned = action;
  if (timeMatch || dayMatch) {
    dueFull = combineDateTime(dayMatch ? dayMatch[0] : null, timeMatch ? timeMatch[0] : null);
    if (timeMatch) cleaned = cleaned.replace(timeMatch[0], "");
    if (dayMatch) cleaned = cleaned.replace(dayMatch[0], "");
    cleaned = cleaned.replace(/\s*\.?\s*$/, "").replace(/\s{2,}/g, " ").trim();
  }
  if (cleaned.length < 2) {
    // Title was entirely timing — fall back to a generic "Reminder" so the
    // chip is still useful even without the original wording.
    cleaned = "Reminder";
  }
  return { kind: "task", title: cleaned.charAt(0).toUpperCase() + cleaned.slice(1), due: dueFull };
}

function detectMeal(text) {
  // "X for dinner / X for dinner tonight / make X for breakfast tomorrow"
  const pattern = /^(?:(?:let's|lets|we're going to|i'm making|im making|cook|cooking|let's have|lets have|gonna have|i'll make|ill make)\s+)?(.+?)\s+for\s+(breakfast|lunch|dinner|brunch|supper)(?:\s+(today|tomorrow|tonight|this week))?\.?$/i;
  const match = pattern.exec(text);
  if (!match) return null;
  const title = match[1].trim();
  const slot = match[2].toLowerCase();
  const when = match[3]?.toLowerCase();
  if (title.length < 2 || title.length > 80) return null;
  // If a verb was prefixed ("Make pizza"), strip it so the meal title is just the dish.
  let storedTitle = title.replace(/^(?:let's|lets|we're going to|i'm making|im making|cook|cooking|let's have|lets have|gonna have|i'll make|ill make)\s+/i, "").trim();
  const date = when ? combineDateTime(when, null) : null;
  return { kind: "meal", title: storedTitle, slot, date };
}

// A richer set of nouns that almost always correspond to a calendar event.
// Each entry has the canonical form; we match word-boundaries case-insensitively.
const EVENT_NOUNS = [
  "appointment", "meeting", "practice", "session", "game", "match",
  "class", "lesson", "tutorial", "workshop", "seminar", "lecture",
  "dentist", "doctor", "vet", "checkup", "check-up",
  "birthday party", "birthday", "party", "celebration",
  "playdate", "play date", "play-date",
  "date night", "date", "anniversary", "reunion",
  "recital", "concert", "show", "performance", "play",
  "showcase", "ceremony", "rehearsal", "audition",
  "wedding", "funeral", "service", "memorial",
  "movie", "theater", "theatre", "opera", "ballet",
  "court", "trial", "hearing", "deposition",
  "interview", "orientation",
  "reservation", "reservations", "booking",
  "club", "recess", "training", "tryouts",
  "soccer", "football", "basketball", "hockey", "baseball", "tennis", "golf",
  "ballet class", "piano lesson", "swimming lesson",
  "field trip", "open house", "graduation", "commencement",
  "brunch", "lunch date", "dinner date", "drinks",
  "trip", "flight", "layover",
  "hot yoga", "spin class", "crossfit",
].join("|");
const EVENT_NOUN_RE = new RegExp(`\\b(${EVENT_NOUNS})\\b`, "i");

function detectEvent(text) {
  const hasEventNoun = EVENT_NOUN_RE.test(text);
  // Allow generic "event"/"appointment" + noun phrases, e.g. "lunch with Sarah".
  const hasGenericEventWord = /\b(event|appointment|date|plan|plans|plans for|we have a|there's|theres|is having|is having a|having a|i'm going to|im going to|i'm attending|i'm at|i'm)\b/i.test(text) && !/\b(add|need|out of|low on|short on)\b/i.test(text);
  if (!hasEventNoun && !hasGenericEventWord) return null;
  const dayMatch = text.match(DAY_WORDS);
  const timeMatch = text.match(TIME_PATTERN);
  if (!dayMatch && !timeMatch && !/^\s*(remind me|don't forget)\b/i.test(text)) return null;
  const titleMatch = text.match(/^(?:i have a|i have|there's|theres|there's a|theres a|we have a|we have|we have an|we're having|were having|i'm having|im having|i've got|ive got|got a|got an|got|is having|having|don't forget|remind me about|remind me of|it's|its)\s+(.+?)\.?$/i);
  let cleanedTitle = (titleMatch ? titleMatch[1] : text)
    .replace(/\s+(?:at|on|by|next|in)\b.*$/i, "")
    .replace(dayMatch ? dayMatch[0] : "", "")
    .replace(timeMatch ? timeMatch[0] : "", "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (cleanedTitle.length < 2 || cleanedTitle.length > 80) return null;
  const date = combineDateTime(dayMatch ? dayMatch[0] : null, timeMatch ? timeMatch[0] : null);
  const title = cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1);
  return { kind: "event", title, date };
}

/**
 * Public entry point. Returns at most one intent.
 * Caller (Chat.jsx) decides whether to surface it as a suggestion chip.
 */
export function detectIntent(text) {
  if (!text || typeof text !== "string") return null;
  const t = text.trim();
  if (t.length < 4 || t.length > 200) return null;
  if (t.endsWith("?")) return null;
  if (/^https?:\/\//i.test(t)) return null;
  return detectGrocery(t)
    || detectTask(t)
    || detectMeal(t)
    || detectEvent(t);
}

/// Stable key for localStorage dismissal storage. Encodes the message id
/// and the intent signature so re-edits of the same message don't dismiss
/// the new version forever.
export function intentKey(messageId, intent) {
  if (!messageId || !intent) return null;
  if (intent.kind === "grocery") return `grocery:${(intent.items || []).join("|").toLowerCase()}`;
  if (intent.kind === "task") return `task:${(intent.title || "").toLowerCase()}|${intent.due || ""}`;
  if (intent.kind === "meal") return `meal:${intent.title.toLowerCase()}|${intent.slot}|${intent.date || ""}`;
  if (intent.kind === "event") return `event:${intent.title.toLowerCase()}|${intent.date || ""}`;
  return null;
}
