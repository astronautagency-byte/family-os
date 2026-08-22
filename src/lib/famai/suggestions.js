// Suggested prompts + suggested actions generated deterministically from
// FamOS state (PRD §18). No LLM calls — these are pure rules over the
// household snapshot, shown as chips/cards in the Ask Fam surface.

import { todayISO, formatTime } from "../dates";

export function getSuggestedPrompts(state = {}, screen = "") {
  const prompts = [];
  const today = todayISO();
  const events = (state.events || []).filter((event) => event.start && event.start.slice(0, 10) === today);
  const openTasks = (state.tasks || []).filter((task) => !task.done);

  if (screen === "meals") {
    prompts.push({ text: "What can I make with what's in the kitchen?", tone: "meals", intent: "GENERATE_GROCERY_LIST" });
    prompts.push({ text: "Plan easy dinners this week", tone: "meals", intent: "PLAN_WEEK" });
  } else if (screen === "groceries" || screen === "kitchen") {
    prompts.push({ text: "Add what's missing for this week", tone: "groceries", intent: "ADD_LIST_ITEM" });
    prompts.push({ text: "What's left on the list?", tone: "groceries", intent: "GET_LIST" });
  } else if (screen === "calendar") {
    prompts.push({ text: "What's on today?", tone: "calendar", intent: "GET_SCHEDULE" });
    prompts.push({ text: "What's everyone doing this weekend?", tone: "calendar", intent: "GET_SCHEDULE" });
    prompts.push({ text: "Any scheduling conflicts this week?", tone: "calendar", intent: "GET_CONFLICTS" });
  } else if (screen === "tasks") {
    prompts.push({ text: "What's due today?", tone: "tasks", intent: "GET_TASKS" });
    prompts.push({ text: "Create a task to register for soccer by Friday", tone: "tasks", intent: "CREATE_TASK" });
  } else {
    // Today / default
    prompts.push({ text: "What's happening today?", tone: "calendar", intent: "GET_TODAY" });
    if (openTasks.length) prompts.push({ text: "Anything we're forgetting?", tone: "tasks", intent: "GET_TASKS" });
    if (events.length) prompts.push({ text: "What's for dinner tonight?", tone: "meals", intent: "GET_EVENT" });
    prompts.push({ text: "What's next on the list?", tone: "tasks", intent: "GET_TASKS" });
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
  const events = (state.events || []).filter((event) => event.start && event.start.slice(0, 10) === today);
  const openTasks = (state.tasks || []).filter((task) => !task.done);
  const openGroceries = (state.groceries || []).filter((item) => !item.checked);

  // Readiness: open tasks without a due date drift.
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
      label: `${openGroceries.length} item${openGroceries.length === 1 ? "" : "s"} left to buy`,
      kind: "groceries",
      prompt: "What's left on the grocery list?",
    });
  }

  return actions.slice(0, 4);
}
