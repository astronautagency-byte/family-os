// Suggested prompts + suggested actions generated deterministically from
// FamOS state (PRD §18). No LLM calls — these are pure rules over the
// household snapshot, shown as chips/cards in the Ask Fam surface.

import { todayISO, addDays, eventDateLocal } from "../dates";

export function getSuggestedPrompts(state = {}, screen = "") {
  const prompts = [];
  const today = todayISO();
  const events = (state.events || []).filter((event) => event.start && eventDateLocal(event.start) === today);
  const openTasks = (state.tasks || []).filter((task) => !task.done);
  const groceries = (state.groceries || []).filter((item) => !item.checked);
  const meals = (state.meals || []).filter((meal) => meal.date === today);
  const kitchenWatch = state.kitchenWatch || state.inventory || [];
  const expiringItems = kitchenWatch.filter((item) => {
    if (!item.expiry_date) return false;
    const diff = (new Date(item.expiry_date) - new Date(today)) / 86400000;
    return diff <= 3 && diff >= -1;
  });

  if (screen === "meals") {
    if (!meals.length) {
      prompts.push({ text: "What can I make with what's in the kitchen?", tone: "meals" });
      prompts.push({ text: "Plan easy dinners this week", tone: "meals" });
    } else {
      prompts.push({ text: "What's for dinner tonight?", tone: "meals" });
      prompts.push({ text: "Plan meals for the rest of the week", tone: "meals" });
    }
    if (expiringItems.length) {
      prompts.push({ text: `Use up the ${expiringItems[0].name} before it expires`, tone: "kitchen" });
    }
  } else if (screen === "groceries" || screen === "kitchen") {
    if (groceries.length) {
      prompts.push({ text: "What's left on the list?", tone: "groceries" });
      prompts.push({ text: "Group the list by aisle", tone: "groceries" });
    } else {
      prompts.push({ text: "Start a new grocery list", tone: "groceries" });
    }
    if (expiringItems.length) {
      prompts.push({ text: "What's expiring soon?", tone: "kitchen" });
    }
  } else if (screen === "calendar") {
    prompts.push({ text: "What's on today?", tone: "calendar" });
    if (events.length) {
      prompts.push({ text: "Any scheduling conflicts this week?", tone: "calendar" });
    } else {
      prompts.push({ text: "What's everyone doing this weekend?", tone: "calendar" });
    }
  } else if (screen === "tasks") {
    prompts.push({ text: "What's due today?", tone: "tasks" });
    if (openTasks.length > 3) {
      prompts.push({ text: "What are the most urgent tasks?", tone: "tasks" });
    }
  } else {
    // Today / default — context-aware suggestions
    if (events.length) {
      prompts.push({ text: "What's happening today?", tone: "calendar" });
    } else {
      prompts.push({ text: "What's on today?", tone: "calendar" });
    }
    if (openTasks.length) {
      prompts.push({ text: "Anything we're forgetting?", tone: "tasks" });
    }
    if (!meals.length) {
      prompts.push({ text: "What's for dinner tonight?", tone: "meals" });
    }
    if (expiringItems.length) {
      prompts.push({ text: "What's expiring soon?", tone: "kitchen" });
    }
    if (groceries.length) {
      prompts.push({ text: "What's left to buy?", tone: "groceries" });
    }
  }

  // Deduplicate, cap at 4.
  const seen = new Set();
  const unique = prompts.filter((prompt) => {
    const key = prompt.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.slice(0, 4);
}

// Suggested *actions* — concrete one-tap operations driven by state gaps.
export function getSuggestedActions(state = {}) {
  const actions = [];
  const today = todayISO();
  const events = (state.events || []).filter((event) => event.start && eventDateLocal(event.start) === today);
  const openTasks = (state.tasks || []).filter((task) => !task.done);
  const openGroceries = (state.groceries || []).filter((item) => !item.checked);
  const meals = (state.meals || []).filter((meal) => meal.date === today);
  const kitchenWatch = state.kitchenWatch || state.inventory || [];
  const expiringItems = kitchenWatch.filter((item) => {
    if (!item.expiry_date) return false;
    const diff = (new Date(item.expiry_date) - new Date(today)) / 86400000;
    return diff <= 3 && diff >= -1;
  });
  const overdueTasks = openTasks.filter((task) => task.due && task.due < today);

  // Urgent actions first
  if (overdueTasks.length) {
    actions.push({
      id: "tasks-overdue",
      label: `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}`,
      kind: "tasks",
      prompt: "What tasks are overdue?",
    });
  }
  if (expiringItems.length) {
    actions.push({
      id: "kitchen-expiring",
      label: `${expiringItems.length} item${expiringItems.length === 1 ? "" : "s"} expiring`,
      kind: "kitchen",
      prompt: "What's expiring soon?",
    });
  }
  if (openTasks.length) {
    actions.push({
      id: "tasks-open",
      label: `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}`,
      kind: "tasks",
      prompt: "What tasks are open?",
    });
  }
  if (openGroceries.length) {
    actions.push({
      id: "groceries-open",
      label: `${openGroceries.length} item${openGroceries.length === 1 ? "" : "s"} to buy`,
      kind: "groceries",
      prompt: "What's left on the grocery list?",
    });
  }
  if (!meals.length && events.length) {
    actions.push({
      id: "meals-plan",
      label: "Plan tonight's dinner",
      kind: "meals",
      prompt: "What's for dinner tonight?",
    });
  }

  return actions.slice(0, 4);
}
