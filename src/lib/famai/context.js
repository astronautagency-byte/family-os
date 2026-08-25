// Compact household context (PRD §15) + deterministic answer generators.
// The context blob sent to any LLM is built here and is deliberately small —
// members summary + minimal scoped entities, never full household history.

import { todayISO, formatDayLabel, formatTime, addDays, eventDateLocal } from "../dates";

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
    .filter((event) => event.start && eventDateLocal(event.start) === today)
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
  const events = (state.events || []).filter((event) => event.start && next7.includes(eventDateLocal(event.start)));
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

// GET_MEALS — show planned meals for today or a specific date.
export function answerGetMeals(state = {}) {
  const today = todayISO();
  const meals = (state.meals || []).filter((meal) => meal.date === today);
  if (!meals.length) {
    // Check if any meals are planned this week
    const thisWeek = (state.meals || []).filter((meal) => meal.date >= today && meal.date <= addDays(today, 6));
    if (thisWeek.length) {
      const byDate = {};
      thisWeek.forEach((meal) => { (byDate[meal.date] = byDate[meal.date] || []).push(meal); });
      const lines = Object.entries(byDate).map(([date, dayMeals]) => `• ${formatDayLabel(date)}: ${dayMeals.map((m) => `${m.slot || 'Meal'} — ${m.title}`).join(", ")}`);
      return `No meals planned for today, but you have ${thisWeek.length} meal${thisWeek.length === 1 ? '' : 's'} this week:\n${lines.join("\n")}`;
    }
    return "No meals planned yet. Want me to suggest something based on what's in the kitchen?";
  }
  const slots = meals.map((meal) => `${meal.slot || 'Meal'}: ${meal.title}${meal.notes ? ` (${meal.notes})` : ''}`);
  return `Today's meals:\n${slots.map((s) => `• ${s}`).join("\n")}`;
}

// GET_KITCHEN_WATCH — show expiring or recently expired kitchen items.
export function answerGetKitchenWatch(state = {}) {
  const today = todayISO();
  const inventory = state.kitchenWatch || state.inventory || [];
  if (!inventory.length) return "Kitchen Watch has no items yet. Add items from your shopping list to track freshness.";
  const expiring = inventory.filter((item) => {
    if (!item.expiry_date) return false;
    const diff = (new Date(item.expiry_date) - new Date(today)) / 86400000;
    return diff <= 7 && diff >= -3;
  }).sort((a, b) => (a.expiry_date || '').localeCompare(b.expiry_date || ''));
  const expired = inventory.filter((item) => item.expiry_date && new Date(item.expiry_date) < new Date(today));
  if (!expiring.length && !expired.length) return "Nothing expiring soon — your kitchen is looking good.";
  const lines = [];
  if (expired.length) lines.push(`**Expired (${expired.length}):** ${expired.map((item) => item.name).join(", ")}`);
  if (expiring.length) lines.push(`**Expiring soon (${expiring.length}):** ${expiring.map((item) => { const days = Math.ceil((new Date(item.expiry_date) - new Date(today)) / 86400000); return `${item.name} (${days <= 0 ? 'today' : days + 'd'})`; }).join(", ")}`);
  return lines.join("\n");
}

// GET_GROCERIES — answer grocery list queries with grouped breakdown.
export function answerGetGroceries(state = {}) {
  const items = (state.groceries || []).filter((item) => !item.checked);
  if (!items.length) return "The grocery list is empty — nothing to pick up.";
  const grouped = items.reduce((map, item) => {
    const cat = item.category || 'Other';
    (map[cat] = map[cat] || []).push(item);
    return map;
  }, {});
  const total = items.length;
  const catCount = Object.keys(grouped).length;
  const lines = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, list]) => `• **${cat}**: ${list.map((item) => item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name).join(", ")}`);
  return `${total} item${total === 1 ? '' : 's'} across ${catCount} categor${catCount === 1 ? 'y' : 'ies'}:\n${lines.join("\n")}`;
}

// GET_MEAL_PLAN — answer queries about upcoming meal plans.
export function answerGetMealPlan(state = {}) {
  const today = todayISO();
  const upcoming = (state.meals || []).filter((meal) => meal.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 14);
  if (!upcoming.length) return "No meals planned for the coming two weeks. Want me to suggest a meal plan?";
  const byDate = {};
  upcoming.forEach((meal) => { (byDate[meal.date] = byDate[meal.date] || []).push(meal); });
  const lines = Object.entries(byDate).slice(0, 7).map(([date, dayMeals]) => `• ${formatDayLabel(date)}: ${dayMeals.map((m) => m.title).join(", ")}`);
  return `Meal plan (${upcoming.length} meals, next 7 days):\n${lines.join("\n")}`;
}
