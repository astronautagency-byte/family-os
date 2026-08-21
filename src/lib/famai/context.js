// Compact household context (PRD §15) + deterministic answer generators.
// The context blob sent to any LLM is built here and is deliberately small —
// members summary + minimal scoped entities, never full household history.

import { todayISO, formatDayLabel, formatTime, addDays } from "../dates";

export function buildCompactContext(state = {}) {
  const members = (state.members || []).map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role || "member",
  }));
  return {
    householdId: state.household?.id || null,
    today: todayISO(),
    members,
    // Only include data the current screen/request actually needs.
    // Level 0 = no household context; callers pass { level } to gate.
    level: state.level ?? 2,
  };
}

// Deterministic answer for GET_SCHEDULE / GET_TODAY / GET_LIST / GET_DRIVER —
// pure functions of FamOS state, zero LLM cost.
export function answerGetSchedule(route) {
  const events = route.data?.events || [];
  const label = route.entities?.label || "that day";
  if (!events.length) return `Nothing on ${label} — the calendar is clear.`;
  const lines = events
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""))
    .map((event) => `• ${formatTime(event.start)} — ${event.title}${event.location ? ` at ${event.location}` : ""}`);
  return `${label.charAt(0).toUpperCase() + label.slice(1)}: ${events.length} commitment${events.length === 1 ? "" : "s"}.\n${lines.join("\n")}`;
}

export function answerGetToday(state = {}) {
  const today = todayISO();
  const events = (state.events || [])
    .filter((event) => event.start && event.start.slice(0, 10) === today)
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  const tasks = (state.tasks || []).filter((task) => !task.done && (!task.due || task.due <= today));
  const groceries = (state.groceries || []).filter((item) => !item.checked);

  const parts = [];
  if (events.length) parts.push(`**Calendar** (${events.length}): ${events.map((event) => `${formatTime(event.start)} ${event.title}`).join(" · ")}`);
  if (tasks.length) parts.push(`**Tasks** (${tasks.length}): ${tasks.slice(0, 5).map((task) => task.title).join(" · ")}${tasks.length > 5 ? ` +${tasks.length - 5} more` : ""}`);
  if (groceries.length) parts.push(`**Groceries** (${groceries.length} open): ${groceries.slice(0, 5).map((item) => item.name).join(" · ")}${groceries.length > 5 ? ` +${groceries.length - 5} more` : ""}`);

  if (!parts.length) return "Today looks clear — no events, no due tasks, and the shopping list is empty. Enjoy the breathing room.";
  return parts.join("\n");
}

export function answerGetList(state = {}) {
  const items = (state.groceries || []).filter((item) => !item.checked);
  if (!items.length) return "The grocery list is empty. Nothing to pick up.";
  const grouped = items.reduce((map, item) => {
    const category = item.category || "Other";
    (map[category] = map[category] || []).push(item);
    return map;
  }, {});
  const lines = Object.entries(grouped).map(([category, list]) => `**${category}**: ${list.map((item) => (item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name)).join(", ")}`);
  return `You have ${items.length} item${items.length === 1 ? "" : "s"} on the list.\n${lines.join("\n")}`;
}

export function answerGetDriver(route, state = {}) {
  const memberName = route.entities?.memberName;
  const date = route.entities?.date;
  const dateLabel = date ? (date === todayISO() ? "today" : formatDayLabel(date)) : "";
  // FamOS tracks rides via transportation; if nothing is assigned yet, we
  // say so plainly and offer to help assign.
  const transport = state.transportation || [];
  const relevant = transport.filter((ride) => {
    if (date && ride.eventStart) return ride.eventStart.slice(0, 10) === date;
    return true;
  });
  const assigned = relevant.filter((ride) => ride.driverId);
  if (assigned.length) {
    const names = assigned.map((ride) => {
      const driver = (state.members || []).find((member) => member.id === ride.driverId);
      return `${driver?.name || "Someone"} is driving${ride.eventTitle ? ` for ${ride.eventTitle}` : ""}`;
    });
    return names.join("\n");
  }
  if (memberName) {
    return `${memberName}${dateLabel ? ` ${dateLabel}` : ""} doesn't have a driver assigned yet. Want me to help find one?`;
  }
  return `No driver is assigned${dateLabel ? ` ${dateLabel}` : ""} yet. I can help you request or assign one.`;
}

export function answerGetConflicts(state = {}) {
  const events = (state.events || [])
    .filter((event) => event.start && event.start >= new Date().toISOString())
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  const conflicts = [];
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      const overlapsMember = (a.memberIds || []).some((id) => (b.memberIds || []).includes(id));
      const overlapsTime = new Date(a.end) > new Date(b.start) && new Date(a.start) < new Date(b.end);
      if (overlapsMember && overlapsTime) {
        conflicts.push({ a, b });
      }
    }
  }
  if (!conflicts.length) return "No overlapping commitments found in the next 7 days.";
  const lines = conflicts.slice(0, 5).map(({ a, b }) => `• ${a.title} (${formatTime(a.start)}) overlaps ${b.title} (${formatTime(b.start)})`);
  return `${conflicts.length} possible overlap${conflicts.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
}

export function answerReadiness(state = {}) {
  const today = todayISO();
  const next7 = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const events = (state.events || []).filter((event) => event.start && next7.includes(event.start.slice(0, 10)));
  const openTasks = (state.tasks || []).filter((task) => !task.done);
  const openGroceries = (state.groceries || []).filter((item) => !item.checked);

  const issues = [];
  if (openTasks.length) issues.push(`${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}`);
  if (openGroceries.length) issues.push(`${openGroceries.length} unchecked grocery item${openGroceries.length === 1 ? "" : "s"}`);
  if (!events.length && !openTasks.length && !openGroceries.length) return "You're ready — nothing outstanding in the next 7 days.";

  const head = `This week: ${events.length} event${events.length === 1 ? "" : "s"} planned. ${issues.join(" · ")}.`;
  const suggestions = [];
  if (openTasks.length) suggestions.push("Review the open tasks");
  if (openGroceries.length) suggestions.push("Finish the grocery list");
  if (!events.length) suggestions.push("Plan something fun");
  return `${head}\nSuggested next steps: ${suggestions.join(" · ")}.`;
}
