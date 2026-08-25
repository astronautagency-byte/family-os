// Deterministic intent router. Maps natural language to a structured intent
// WITHOUT calling an LLM. Returns null when the request needs the AI
// fallback (open-ended generation, summarization, planning reasoning).
//
// Every route returns:
//   { intent, confidence (0..1), entities, requires_confirmation, missing_fields }

import { parseDate, parseTime, isoFromParts, parseItems, parseQuantity, findMember, stripFillers } from "./nlp";
import { RISK } from "./guardrails";
import { eventDateLocal } from "../dates";

const ADD_GROCERY_RE = /\b(add|get|buy|put|need|grab|pick up|we(?:'|\s)re out of|out of|ran out of|run out of)\b/i;
const LIST_TARGET_RE = /\b(to|on|in|for)\s+(the\s+)?(grocery|groceries|shopping|list|the list)\b/i;
const EVENT_WORD_RE = /\b(event|game|practice|lesson|appointment|party|playdate|meeting|match|recital|concert|dinner|date|drop[- ]off|pick[- ]up|class|session|tournament|try[- ]out|field trip)\b/i;

// "add milk" | "add milk, bananas and bread" | "we're out of milk"
function routeAddGrocery(text, ctx) {
  // Must have a real grocery signal — otherwise "add leo's soccer game" or
  // "what's on today" would be misread as list items.
  if (!ADD_GROCERY_RE.test(text) && !LIST_TARGET_RE.test(text)) return null;
  const outOf = /\b(we(?:'|\s)re out of|out of|ran out of|run out of)\b/i;
  const body = outOf.test(text)
    ? text.replace(outOf, " ").replace(LIST_TARGET_RE, " ").trim()
    : text
        .replace(ADD_GROCERY_RE, " ")
        .replace(/\b(please|to groceries|on the list|to the list|for the list|to my list)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

  const rawItems = parseItems(body);
  if (!rawItems.length) return null;
  const items = rawItems
    .map((phrase) => parseQuantity(phrase))
    .filter((item) => item.name.length > 1);

  if (!items.length) return null;

  // Deduplicate against existing unchecked groceries — the PRD explicitly
  // wants "avoid duplicates" behaviour; mark existing ones as skipped.
  const existing = new Set(
    (ctx.groceries || [])
      .filter((g) => !g.checked && g.name)
      .map((g) => g.name.toLowerCase().trim()),
  );
  const toAdd = items.filter((item) => !existing.has(item.name.toLowerCase().trim()));
  const skipped = items.length - toAdd.length;

  if (!toAdd.length) {
    return {
      intent: "ADD_LIST_ITEM",
      confidence: 0.98,
      entities: { list: "groceries", items: [] },
      requires_confirmation: false,
      missing_fields: [],
      skippedCount: skipped,
      alreadyHave: true,
    };
  }

  return {
    intent: "ADD_LIST_ITEM",
    confidence: 0.97,
    entities: { list: "groceries", items: toAdd },
    requires_confirmation: false, // Level 1 — reversible with Undo
    missing_fields: [],
    skippedCount: skipped,
  };
}

// "remove milk" | "take milk off the list" | "delete bananas"
function routeRemoveGrocery(text, ctx) {
  if (!/\b(remove|delete|take .* off|drop|get rid of|cross off)\b/i.test(text)) return null;
  const body = text
    .replace(/\b(remove|delete|drop|get rid of|cross off|take)\b/gi, " ")
    .replace(/\b(off|from|of)\b/gi, " ")
    .replace(/\b(the|groceries|grocery|list|shopping)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (body.length < 2) return null;

  const groceries = ctx.groceries || [];
  const name = body.toLowerCase().trim();
  const match = groceries.find((g) => g.name && g.name.toLowerCase().includes(name))
    || groceries.find((g) => g.name && name.includes(g.name.toLowerCase()));

  if (!match) {
    return {
      intent: "REMOVE_LIST_ITEM",
      confidence: 0.55,
      entities: { name: body, list: "groceries" },
      requires_confirmation: false,
      missing_fields: [],
      notFound: true,
    };
  }
  return {
    intent: "REMOVE_LIST_ITEM",
    confidence: 0.9,
    entities: { itemId: match.id, name: match.name, list: "groceries" },
    requires_confirmation: false, // Level 1 — reversible
    missing_fields: [],
  };
}

// "mark bananas done" | "check off eggs" | "mark milk complete"
function routeCompleteGrocery(text, ctx) {
  if (!/\b(mark .* (done|complete|off)|check off|check .* off|done with)\b/i.test(text)) return null;
  const body = text
    .replace(/\b(mark|check|done|complete|off|the)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (body.length < 2) return null;
  const groceries = ctx.groceries || [];
  const name = body.toLowerCase().trim();
  const match = groceries.find((g) => !g.checked && g.name && g.name.toLowerCase().includes(name))
    || groceries.find((g) => !g.checked && g.name && name.includes(g.name.toLowerCase()));
  if (!match) {
    return {
      intent: "COMPLETE_LIST_ITEM",
      confidence: 0.55,
      entities: { name: body },
      requires_confirmation: false,
      missing_fields: [],
      notFound: true,
    };
  }
  return {
    intent: "COMPLETE_LIST_ITEM",
    confidence: 0.92,
    entities: { itemId: match.id, name: match.name },
    requires_confirmation: false, // Level 1
    missing_fields: [],
  };
}

// "what's on today" | "what's everyone doing saturday" | "what's left"
function routeQueryDay(text, ctx) {
  const isToday = /\b(what('| i)?s on (for )?today|what('| i)?s happening today|what do we have today|what are we doing today|what's today)\b/i.test(text);
  const isWeekend = /\b(what('| i)?s everyone doing (this )?weekend|weekend plans|what are we doing (this )?weekend)\b/i.test(text);
  const day = parseDate(text);
  if (isToday || isWeekend || (day && /\b(what|who|when)\b/i.test(text) && /\b(doing|on|up to|planned|happening|going on)\b/i.test(text))) {
    const events = (ctx.events || []).filter((event) => {
      const date = day?.date;
      return date && event.start && eventDateLocal(event.start) === date;
    });
    return {
      intent: "GET_SCHEDULE",
      confidence: 0.94,
      entities: { date: day?.date || null, label: day?.label || null },
      requires_confirmation: false,
      missing_fields: [],
      data: { events },
    };
  }
  return null;
}

// "who's driving leo tonight" | "who's taking sophia" | "can anyone drive me friday"
function routeDriverQuery(text, ctx) {
  if (!/\b(who('| i)?s driving|who('| i)?s taking|who can drive|who('| i)?s picking (up|me)|need a ride|anyone drive|driver)\b/i.test(text)) return null;
  const member = findMember(text, ctx.members || []);
  const day = parseDate(text);
  return {
    intent: "GET_DRIVER",
    confidence: 0.9,
    entities: { memberId: member?.id || null, memberName: member?.name || null, date: day?.date || null },
    requires_confirmation: false,
    missing_fields: [],
  };
}

// "i can take sophia" | "i can drive" | "i'll pick up leo"
function routeOfferDrive(text, ctx) {
  if (!/\b(i(?:'|\s)ll? (?:can )?(?:take|drive|pick up|get)|i can (?:take|drive|pick up)|count me in to drive)\b/i.test(text)) return null;
  const member = findMember(text, ctx.members || []);
  return {
    intent: "OFFER_DRIVE",
    confidence: 0.82,
    entities: { memberId: member?.id || null, memberName: member?.name || null },
    requires_confirmation: true, // Level 2 — assigning responsibility
    missing_fields: member ? [] : ["member"],
  };
}

// "add leo's soccer game saturday at 10" | "create an event for ..."
function routeCreateEvent(text, ctx) {
  const starts = /\b(add|create|schedule|put|book|plan)\b/i.test(text)
    && (EVENT_WORD_RE.test(text)
      || (parseDate(text) !== null && parseTime(text) !== null));
  if (!starts) return null;

  const day = parseDate(text);
  const time = parseTime(text);
  const member = findMember(text, ctx.members || []);
  // Event title: strip date/time/verb fillers, keep the noun phrase.
  const title = stripFillers(text)
    .replace(/\b(add|create|schedule|put|book|plan|an|a|the|for|on|at|this|next)\b/gi, " ")
    .replace(/\b(mon|tue|wed|thu|fri|sat|sun)\w*\b|\b\d{1,2}(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?\b|tonight|tomorrow|today/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(?:^|\s)(?:at|on|for|this|next)\s+(?:the\s+)?$/i, "")
    .trim();

  const needsClarification = !day || !time || title.length < 2;

  return {
    intent: "CREATE_EVENT",
    confidence: needsClarification ? 0.6 : 0.86,
    entities: {
      title: title || null,
      memberId: member?.id || null,
      memberName: member?.name || null,
      date: day?.date || null,
      start_time: time ? `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}` : null,
    },
    requires_confirmation: true, // Level 2 — shared calendar event
    missing_fields: [
      ...(day ? [] : ["date"]),
      ...(time ? [] : ["start_time"]),
      ...(title && title.length >= 2 ? [] : ["title"]),
    ],
  };
}

// "move soccer practice to 6:30" | "soccer moved to 6" | "reschedule ... to friday"
function routeUpdateEvent(text, ctx) {
  if (!/\b(move|moved|reschedule|rescheduled|change|swap|postpone|push)\b/i.test(text)) return null;
  const events = ctx.events || [];
  const day = parseDate(text);
  const time = parseTime(text);
  // Find the event being moved by matching words against event titles.
  const titleWords = stripFillers(text)
    .replace(/\b(move|moved|reschedule|rescheduled|change|swap|postpone|push|to|at|for|the|an)\b/gi, " ")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?\b|tonight|tomorrow|today|this|next|mon|tue|wed|thu|fri|sat|sun\w*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const match = events.find((event) => {
    const title = (event.title || "").toLowerCase();
    return titleWords.length > 2 && title.includes(titleWords.slice(0, 3));
  });

  if (!match || !day) {
    return {
      intent: "UPDATE_EVENT",
      confidence: 0.6,
      entities: { date: day?.date || null, start_time: time ? `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}` : null },
      requires_confirmation: true,
      missing_fields: [match ? "start_time" : "event_id"],
    };
  }
  const newStart = isoFromParts(day.date, time);
  return {
    intent: "UPDATE_EVENT",
    confidence: time ? 0.9 : 0.8,
    entities: { eventId: match.id, title: match.title, date: day.date, start_time: time ? `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}` : null, newStart },
    requires_confirmation: true, // Level 2 — shared event change
    missing_fields: time ? [] : ["start_time"],
  };
}

// "cancel saturday's swimming lesson" | "remove the event"
function routeCancelEvent(text, ctx) {
  if (!/\b(cancel|remove|delete|take off)\b/i.test(text)) return null;
  const events = ctx.events || [];
  const day = parseDate(text);
  const titleWords = stripFillers(text)
    .replace(/\b(cancel|remove|delete|take off|the|a|an|'s|saturday's|sunday's|for|on|this|next)\b/gi, " ")
    .replace(/\b(mon|tue|wed|thu|fri|sat|sun)\w*\b|tonight|tomorrow|today/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const match = events.find((event) => {
    const title = (event.title || "").toLowerCase();
    return titleWords.length > 2 && title.includes(titleWords.slice(0, 3));
  });
  if (!match) {
    return {
      intent: "CANCEL_EVENT",
      confidence: 0.5,
      entities: {},
      requires_confirmation: true,
      missing_fields: ["event_id"],
      notFound: true,
    };
  }
  return {
    intent: "CANCEL_EVENT",
    confidence: 0.88,
    entities: { eventId: match.id, title: match.title, date: day?.date || null },
    requires_confirmation: true, // Level 3 — deleting a shared event
    missing_fields: [],
  };
}

// "remind me to wash leo's jersey tomorrow" | "create a task to register for soccer by friday"
function routeCreateTask(text, ctx) {
  const remind = /\b(remind (me|us)|don't forget to|dont forget to|remember to|need to)\b/i.test(text);
  const taskVerb = /\b(create|add|make|set)\b/i.test(text) && /\b(task|reminder|chore)\b/i.test(text);
  if (!remind && !taskVerb) return null;

  const day = parseDate(text);
  const member = findMember(text, ctx.members || []);
  const title = stripFillers(text)
    .replace(/\b(remind|me|us|to|create|add|make|set|a|an|task|reminder|chore|by|for|on|about|the)\b/gi, " ")
    .replace(/\b(tomorrow|today|tonight|this|next)\b|\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    intent: "CREATE_TASK",
    confidence: title.length > 3 ? 0.88 : 0.55,
    entities: {
      title,
      assigneeId: member?.id || null,
      assigneeName: member?.name || null,
      due: day?.date || null,
    },
    requires_confirmation: false, // Level 1 — personal/household task, reversible
    missing_fields: [
      ...(title.length > 3 ? [] : ["title"]),
      ...(day ? [] : ["due"]),
    ],
  };
}

// "mark the permission form done" | "complete the task"
function routeCompleteTask(text, ctx) {
  if (!/\b(mark .* done|mark .* complete|complete (the|this)|check off|finish (the|this))\b/i.test(text)) return null;
  const tasks = (ctx.tasks || []).filter((task) => !task.done);
  const body = stripFillers(text)
    .replace(/\b(mark|done|complete|complete|finish|check off|the|this)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const match = tasks.find((task) => task.title && task.title.toLowerCase().includes(body))
    || tasks.find((task) => task.title && body.includes(task.title.toLowerCase()));
  if (!match) {
    return {
      intent: "COMPLETE_TASK",
      confidence: 0.5,
      entities: {},
      requires_confirmation: false,
      missing_fields: ["task_id"],
      notFound: true,
    };
  }
  return {
    intent: "COMPLETE_TASK",
    confidence: 0.9,
    entities: { taskId: match.id, title: match.title },
    requires_confirmation: false, // Level 1 — reversible
    missing_fields: [],
  };
}

// "what's left on the list" | "what do we need" | "what's on the grocery list"
function routeQueryList(text, ctx) {
  if (!/\b(what('| i)?s (left|on|on the list)|what do we need|what are we missing|what's missing|list)\b/i.test(text)) return null;
  const items = (ctx.groceries || []).filter((g) => !g.checked);
  return {
    intent: "GET_LIST",
    confidence: 0.93,
    entities: { list: "groceries" },
    requires_confirmation: false,
    missing_fields: [],
    data: { items },
  };
}

// "what's for dinner" / "what are we eating today" / "meal plan"
function routeQueryMeals(text, ctx) {
  if (!/\b(meal|dinner|lunch|breakfast|eating|food|cook|recipe|plan|menu)\b/i.test(text)) return null;
  if (!/\b(what|how|show|plan|check|list|any|tonight|today|tomorrow|this week|coming)\b/i.test(text)) return null;
  // Exclude write intents like "plan a meal" or "add dinner"
  if (/\b(add|create|plan|set|make)\b/i.test(text) && /\b(a|the|for|tonight)\b/i.test(text) && !/\b(what|how)\b/i.test(text)) return null;
  const intent = /\b(plan|menu|this week|coming|upcoming)\b/i.test(text) ? "GET_MEAL_PLAN" : "GET_MEALS";
  return {
    intent,
    confidence: 0.91,
    entities: {},
    requires_confirmation: false,
    missing_fields: [],
  };
}

// "what's expiring" / "kitchen watch" / "what's going bad" / "freshness"
function routeQueryKitchenWatch(text, ctx) {
  if (!/\b(expir|fresh|going bad|kitchen|watch|spoil|shelf|fridge|pantry|use .*(before|soon|up))\b/i.test(text)) return null;
  return {
    intent: "GET_KITCHEN_WATCH",
    confidence: 0.92,
    entities: {},
    requires_confirmation: false,
    missing_fields: [],
  };
}

// "what's on the grocery list" / "what do we need to buy" — GET_GROCERIES
function routeQueryGroceries(text, ctx) {
  if (!/\b(grocer|shopping|buy|pick up|store)\b/i.test(text)) return null;
  if (!/\b(what|how|show|list|check|any|need|missing|left)\b/i.test(text)) return null;
  return {
    intent: "GET_GROCERIES",
    confidence: 0.9,
    entities: {},
    requires_confirmation: false,
    missing_fields: [],
  };
}

// "what's everyone doing saturday" / "what are we doing this weekend" — handled
// by routeQueryDay; here the umbrella router wires everything together.
export function routeIntent(text, ctx = {}) {
  if (!text || !text.trim()) return null;
  const clean = text.trim();

  // Order matters: specific write intents win over the generic grocery add
  // router (which matches any "add …" phrasing), and read intents last so
  // "what's on today" never becomes a list item.
  const routers = [
    routeCreateEvent,
    routeUpdateEvent,
    routeCancelEvent,
    routeCreateTask,
    routeCompleteTask,
    routeRemoveGrocery,
    routeCompleteGrocery,
    routeAddGrocery,
    routeQueryDay,
    routeDriverQuery,
    routeOfferDrive,
    routeQueryList,
    routeQueryMeals,
    routeQueryKitchenWatch,
    routeQueryGroceries,
  ];

  for (const router of routers) {
    const result = router(clean, ctx);
    if (result) return result;
  }
  return null;
}

export function riskForIntent(intent) {
  switch (intent) {
    case "ADD_LIST_ITEM":
    case "REMOVE_LIST_ITEM":
    case "COMPLETE_LIST_ITEM":
    case "CREATE_TASK":
    case "COMPLETE_TASK":
      return RISK.REVERSIBLE;
    case "CREATE_EVENT":
    case "UPDATE_EVENT":
    case "OFFER_DRIVE":
      return RISK.MODERATE;
    case "CANCEL_EVENT":
      return RISK.HIGH;
    default:
      return RISK.READ;
  }
}

// Confidence rules (PRD §10):
//   >= 0.90 + reversible  -> execute directly with Undo
//   0.70–0.89             -> show action preview
//   < 0.70                -> ask one concise clarification question
export function shouldExecuteDirectly(intent, confidence, risk) {
  return confidence >= 0.9 && risk <= RISK.REVERSIBLE;
}

export function shouldPreview(intent, confidence) {
  return confidence >= 0.7 && confidence < 0.9;
}
