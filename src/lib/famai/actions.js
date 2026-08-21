// Deterministic action layer. Each action wraps a single FamOS operation
// through the FamilyContext API — Fam AI never writes to the database
// directly. Every write records an undo entry so the UI can offer Undo
// using stored state, never an LLM "reverse".

let undoSeq = 0;

// Undo store: in-memory for the current session. Each record captures the
// function + previous/new state so reversal is deterministic.
const undoRecords = new Map();

export function recordUndo({ actionId, userId, householdId, fn, previousState, newState, summary }) {
  const record = {
    actionId,
    userId,
    householdId,
    fn,
    previousState,
    newState,
    summary,
    timestamp: Date.now(),
    undoExpiry: Date.now() + 30 * 60 * 1000, // 30 min
  };
  undoRecords.set(actionId, record);
  return record;
}

export function getUndoRecord(actionId) {
  const record = undoRecords.get(actionId);
  if (!record) return null;
  if (Date.now() > record.undoExpiry) {
    undoRecords.delete(actionId);
    return null;
  }
  return record;
}

export function removeUndoRecord(actionId) {
  undoRecords.delete(actionId);
}

// Executes a structured action against the FamilyContext API.
// `api` is the destructured context: { addGrocery, removeGrocery, toggleGrocery,
// addTask, toggleTask, addEvent, updateEvent, removeEvent, members, groceries,
// tasks, events, currentUserId, household }.
// Returns { ok, message, undo, result }.
export async function executeAction(intent, entities, api) {
  const userId = api.currentUserId || api.user?.id || null;
  const householdId = api.household?.id || null;

  try {
    switch (intent) {
      case "ADD_LIST_ITEM": {
        const items = entities.items || [];
        if (!items.length) return { ok: true, message: "Everything on your list already — nothing to add.", result: [] };
        const added = [];
        for (const item of items) {
          const before = api.groceries || [];
          await api.addGrocery({
            name: item.name,
            quantity: item.quantity || 1,
            unit: item.unit || "",
            category: item.category || undefined,
          });
          const after = api.groceries || [];
          const created = after.find((g) => g.name && g.name.toLowerCase() === item.name.toLowerCase() && !before.some((b) => b.id === g.id));
          const actionId = `undo-${++undoSeq}`;
          recordUndo({
            actionId,
            userId,
            householdId,
            fn: "removeGrocery",
            previousState: { name: item.name },
            newState: { name: item.name },
            summary: `Added ${item.name} to groceries`,
          });
          added.push({ name: item.name, undoId: actionId, id: created?.id });
        }
        const names = added.map((item) => item.name).join(", ");
        return {
          ok: true,
          message: `Added ${names} to Groceries.`,
          result: added,
          undo: added.map((item) => item.undoId),
          canUndo: true,
        };
      }

      case "REMOVE_LIST_ITEM": {
        const id = entities.itemId;
        if (!id) return { ok: false, message: `I couldn't find "${entities.name}" on the list.`, result: null };
        const item = (api.groceries || []).find((g) => g.id === id);
        if (!item) return { ok: false, message: "That item isn't on the list anymore.", result: null };
        await api.removeGrocery(id);
        const actionId = `undo-${++undoSeq}`;
        recordUndo({
          actionId, userId, householdId,
          fn: "addGrocery",
          previousState: { name: item.name, quantity: item.quantity, unit: item.unit, category: item.category },
          newState: { name: item.name },
          summary: `Removed ${item.name} from groceries`,
        });
        return { ok: true, message: `Removed ${item.name} from the list.`, result: item, undo: [actionId], canUndo: true };
      }

      case "COMPLETE_LIST_ITEM": {
        const id = entities.itemId;
        if (!id) return { ok: false, message: `I couldn't find "${entities.name}" to check off.`, result: null };
        await api.toggleGrocery(id);
        const item = (api.groceries || []).find((g) => g.id === id);
        const actionId = `undo-${++undoSeq}`;
        recordUndo({
          actionId, userId, householdId,
          fn: "toggleGrocery",
          previousState: { id },
          newState: { id },
          summary: `Checked off ${item?.name || "item"}`,
        });
        return { ok: true, message: `Marked ${item?.name || "it"} done.`, result: item, undo: [actionId], canUndo: true };
      }

      case "CREATE_TASK": {
        const title = entities.title;
        if (!title) return { ok: false, message: "What should the task be?", result: null };
        await api.addTask({
          title,
          assigneeId: entities.assigneeId || undefined,
          due: entities.due || null,
          taskType: "home",
        });
        const actionId = `undo-${++undoSeq}`;
        recordUndo({
          actionId, userId, householdId,
          fn: "removeTask",
          previousState: { title },
          newState: { title },
          summary: `Created task: ${title}`,
        });
        const when = entities.due ? ` due ${entities.due}` : "";
        return { ok: true, message: `Added the task "${title}"${when}.`, result: { title }, undo: [actionId], canUndo: true };
      }

      case "COMPLETE_TASK": {
        const id = entities.taskId;
        if (!id) return { ok: false, message: "I couldn't find that task.", result: null };
        await api.toggleTask(id);
        const task = (api.tasks || []).find((t) => t.id === id);
        const actionId = `undo-${++undoSeq}`;
        recordUndo({
          actionId, userId, householdId,
          fn: "toggleTask",
          previousState: { id },
          newState: { id },
          summary: `Completed "${task?.title || "task"}"`,
        });
        return { ok: true, message: `Marked "${task?.title || "it"}" done.`, result: task, undo: [actionId], canUndo: true };
      }

      case "CREATE_EVENT": {
        const { title, date, start_time, memberId } = entities;
        if (!title || !date || !start_time) {
          const missing = [];
          if (!title) missing.push("title");
          if (!date) missing.push("date");
          if (!start_time) missing.push("start time");
          return { ok: false, message: `I need a ${missing.join(" and ")} to create that event.`, missing, result: null };
        }
        const start = `${date}T${start_time}:00`;
        const end = new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
        await api.addEvent({
          title,
          start,
          end,
          location: "",
          memberIds: memberId ? [memberId] : [],
        });
        const actionId = `undo-${++undoSeq}`;
        recordUndo({
          actionId, userId, householdId,
          fn: "removeEvent",
          previousState: { title, start },
          newState: { title, start },
          summary: `Added event: ${title}`,
        });
        return { ok: true, message: `Added "${title}" to the calendar.`, result: { title, start }, undo: [actionId], canUndo: true };
      }

      case "UPDATE_EVENT": {
        const { eventId, newStart, title } = entities;
        if (!eventId || !newStart) return { ok: false, message: "I need a new time to move that event.", result: null };
        const event = (api.events || []).find((e) => e.id === eventId);
        const oldStart = event?.start;
        await api.updateEvent(eventId, { start: newStart, end: new Date(new Date(newStart).getTime() + 60 * 60 * 1000).toISOString() });
        const actionId = `undo-${++undoSeq}`;
        recordUndo({
          actionId, userId, householdId,
          fn: "updateEvent",
          previousState: { id: eventId, start: oldStart },
          newState: { id: eventId, start: newStart },
          summary: `Moved "${title || event?.title || "event"}"`,
        });
        return { ok: true, message: `Moved "${title || event?.title}" to the new time.`, result: { id: eventId }, undo: [actionId], canUndo: true };
      }

      case "CANCEL_EVENT": {
        const { eventId, title } = entities;
        if (!eventId) return { ok: false, message: "I couldn't find that event to cancel.", result: null };
        const event = (api.events || []).find((e) => e.id === eventId);
        await api.removeEvent(eventId);
        const actionId = `undo-${++undoSeq}`;
        recordUndo({
          actionId, userId, householdId,
          fn: "addEvent",
          previousState: { title: event?.title || title, start: event?.start, end: event?.end, location: event?.location || "" },
          newState: { title: event?.title || title },
          summary: `Cancelled "${event?.title || title}"`,
        });
        return { ok: true, message: `Cancelled "${event?.title || title}".`, result: { id: eventId }, undo: [actionId], canUndo: true };
      }

      default:
        return { ok: false, message: "I don't know how to run that action yet.", result: null };
    }
  } catch (error) {
    return { ok: false, message: error?.message || "That action could not be completed.", result: null };
  }
}

// Reverses a recorded action using the stored state — never an LLM call.
export async function undoAction(actionId, api) {
  const record = getUndoRecord(actionId);
  if (!record) return { ok: false, message: "That action can no longer be undone." };
  try {
    switch (record.fn) {
      case "removeGrocery": {
        const item = record.previousState;
        await api.addGrocery({ name: item.name, quantity: item.quantity || 1, unit: item.unit || "", category: item.category || undefined });
        break;
      }
      case "addGrocery": {
        // Find the re-added item by name and remove it.
        const name = record.previousState.name;
        const grocery = (api.groceries || []).find((g) => g.name && g.name.toLowerCase() === name.toLowerCase());
        if (grocery) await api.removeGrocery(grocery.id);
        break;
      }
      case "toggleGrocery":
      case "toggleTask": {
        const id = record.previousState.id;
        if (record.fn === "toggleGrocery") await api.toggleGrocery(id);
        else await api.toggleTask(id);
        break;
      }
      case "removeTask": {
        const title = record.previousState.title;
        await api.addTask({ title, taskType: "home" });
        break;
      }
      case "removeEvent": {
        const { title, start } = record.previousState;
        const end = new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
        await api.addEvent({ title, start, end, location: "" });
        break;
      }
      case "updateEvent": {
        const { id, start } = record.previousState;
        await api.updateEvent(id, { start, end: new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString() });
        break;
      }
      case "addEvent": {
        const { title, start, end, location } = record.previousState;
        if (start) await api.addEvent({ title, start, end, location: location || "" });
        break;
      }
      default:
        return { ok: false, message: "This action can't be undone." };
    }
    removeUndoRecord(actionId);
    return { ok: true, message: `Undid: ${record.summary}` };
  } catch (error) {
    return { ok: false, message: error?.message || "Could not undo that action." };
  }
}
