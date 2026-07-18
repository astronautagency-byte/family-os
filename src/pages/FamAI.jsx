import { useState } from "react";
import {
  Bot,
  CalendarDays,
  CheckSquare,
  ChefHat,
  Send,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import { Avatar, Card, PrimaryButton, SecondaryButton } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useFamily } from "../context/FamilyContext";
import { groceryItemsForMealPlan, suggestMealsFromGroceries } from "../data/recipeBox";
import { addDays, formatDayLabel, todayISO } from "../lib/dates";
import { supabase } from "../lib/supabase";

const actionMeta = {
  add_task: { label: "Create task", Icon: CheckSquare },
  add_grocery: { label: "Add grocery", Icon: ShoppingCart },
  add_event: { label: "Add event", Icon: CalendarDays },
  plan_meal: { label: "Plan meal", Icon: ChefHat },
};

const actionSummary = (action) => action.args.title || action.args.name || "New item";
const prompts = [
  {
    label: "Tasks",
    tone: "tasks",
    Icon: CheckSquare,
    text: "Assign this week's chores",
    prompt:
      "Use the current FamOS household context and prepare a balanced chore plan for this week. Create 3 to 5 task actions, spread them across available family members, due over the next 7 days, with task_type set to home or errand. If there are no obvious chores already listed, use practical defaults like tidy bedrooms, take out trash, fold laundry, clear dishes, water plants, or feed pets. Make reasonable choices for review instead of asking follow-up questions unless there are no family members.",
  },
  {
    label: "Meals",
    tone: "meals",
    Icon: ChefHat,
    text: "Plan easy dinners",
    prompt:
      "Use the current FamOS meal and grocery context to plan five easy family dinners over the next 7 days. Create plan_meal actions for dinner slots with short helpful notes. Prefer low-prep, family-friendly meals and avoid duplicating meals already planned. If there are no constraints, choose balanced defaults and prepare them for review.",
  },
  {
    label: "Calendar",
    tone: "calendar",
    Icon: CalendarDays,
    text: "Find our busiest day",
    prompt:
      "Use the current FamOS calendar, task, and meal context to identify the busiest day in the next 7 days. Count events, due tasks, and planned meals. Give a concise answer with the busiest day, why it is busy, and one practical suggestion to make the day easier. Do not ask follow-up questions unless there is no schedule data at all.",
  },
  {
    label: "Groceries",
    tone: "groceries",
    Icon: ShoppingCart,
    text: "Build a shopping list",
    prompt:
      "Use the current FamOS meal plan and grocery context to prepare a useful shopping list. Add only missing grocery items as add_grocery actions and avoid duplicates already on the unchecked list. If no meals are planned, create a sensible starter list for five easy family dinners, grouped by common grocery categories. Prepare the items for review instead of asking follow-up questions.",
  },
];

function makeMemberNameMap(members = []) {
  return members.reduce((map, member) => {
    map[member.id] = member.name;
    return map;
  }, {});
}

function analyzeBusiestDay({ events = [], tasks = [], meals = [], members = [] }) {
  const today = todayISO();
  const memberNames = makeMemberNameMap(members);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index);
    const dayEvents = events
      .filter((event) => event.start?.slice(0, 10) === date)
      .map((event) => ({
        type: "event",
        title: event.title,
        detail: event.start ? new Date(event.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "",
      }));
    const dayTasks = tasks
      .filter((task) => !task.done && task.due === date)
      .map((task) => ({
        type: "task",
        title: task.title,
        detail: task.assigneeId ? memberNames[task.assigneeId] : "",
      }));
    const dayMeals = meals
      .filter((meal) => meal.date === date && meal.title)
      .map((meal) => ({
        type: "meal",
        title: `${meal.slot}: ${meal.title}`,
        detail: "",
      }));
    const items = [...dayEvents, ...dayTasks, ...dayMeals];
    return {
      date,
      label: formatDayLabel(date),
      events: dayEvents,
      tasks: dayTasks,
      meals: dayMeals,
      items,
      score: dayEvents.length * 2 + dayTasks.length * 1.5 + dayMeals.length,
    };
  });

  const busiest = [...days].sort((a, b) => b.score - a.score || b.items.length - a.items.length)[0];
  if (!busiest || busiest.items.length === 0) {
    return "I checked the next 7 days and don’t see any events, due tasks, or planned meals yet. Add a few calendar items or tasks and I can spot the busiest day for you.";
  }

  const topItems = busiest.items.slice(0, 5).map((item) => `• ${item.title}${item.detail ? ` — ${item.detail}` : ""}`).join("\n");
  const counts = [
    `${busiest.events.length} event${busiest.events.length === 1 ? "" : "s"}`,
    `${busiest.tasks.length} open task${busiest.tasks.length === 1 ? "" : "s"}`,
    `${busiest.meals.length} planned meal${busiest.meals.length === 1 ? "" : "s"}`,
  ].join(", ");

  const suggestion = busiest.tasks.length > 1
    ? "I’d move or delegate one task if possible so the day has more breathing room."
    : busiest.events.length > 1
      ? "I’d add a buffer between events or prep anything needed the night before."
      : "It looks manageable — a quick reminder the night before should be enough.";

  return `${busiest.label} looks like your busiest day in the next week: ${counts}.\n\n${topItems}\n\n${suggestion}`;
}

function wantsBusiestDayAnswer(text) {
  return /\b(busiest|busy|most packed|most scheduled|heaviest)\b/i.test(text) && /\b(day|schedule|week|upcoming|calendar)\b/i.test(text);
}

function wantsGroceryList(text) {
  return /\b(grocery|groceries|shopping list|ingredients|instacart|doordash)\b/i.test(text);
}

function wantsMealIdeas(text) {
  return /\b(meal|meals|dinner|recipe|recipes|cook|cooking|menu)\b/i.test(text);
}

function wantsStoreItemsFromTasks(text) {
  return /\b(store items?|shopping|grocer(?:y|ies)|supplies|buy|pick up)\b/i.test(text)
    && /\b(task|tasks|chores?|to[-\s]?do|calendar|event|events)\b/i.test(text);
}

function wantsTasksFromCalendar(text) {
  return /\b(task|tasks|prep|prepare|remind|reminder|chores?|to[-\s]?do)\b/i.test(text)
    && /\b(calendar|event|events|schedule|weekend|this week|upcoming)\b/i.test(text);
}

const compactName = (value = "") => value.toLowerCase();

function uniqueActions(actions = []) {
  const seen = new Set();
  return actions.filter((action) => {
    const key = `${action.type}:${compactName(action.args?.title || action.args?.name || "")}:${action.args?.date || action.args?.due_date || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function taskStoreSuggestions(tasks = [], existingGroceries = []) {
  const existing = new Set(existingGroceries.filter((item) => !item.checked).map((item) => compactName(item.name)));
  const items = [];
  const add = (name, category = "Other", unit = "") => {
    const key = compactName(name);
    if (!key || existing.has(key)) return;
    existing.add(key);
    items.push({ id: `task-store-${items.length}`, type: "add_grocery", args: { name, category, quantity: 1, unit } });
  };

  for (const task of tasks.filter((item) => !item.done).slice(0, 12)) {
    const title = compactName(task.title);
    if (/laundry|wash|fold clothes|towels/.test(title)) { add("Laundry detergent", "Household & Cleaning"); add("Dryer sheets", "Household & Cleaning"); }
    if (/dish|dishes|dishwasher/.test(title)) { add("Dishwasher pods", "Household & Cleaning"); add("Dish soap", "Household & Cleaning"); }
    if (/trash|garbage|recycling/.test(title)) add("Trash bags", "Household & Cleaning");
    if (/clean|tidy|vacuum|bathroom|kitchen/.test(title)) { add("All-purpose cleaner", "Household & Cleaning"); add("Paper towels", "Paper & Disposable"); }
    if (/plant|garden|water/.test(title)) add("Plant food", "Household & Cleaning");
    if (/dog|cat|pet/.test(title)) add(/cat/.test(title) ? "Cat treats" : "Dog treats", "Pet Supplies");
    if (/school|field trip|lunch|homework/.test(title)) { add("Lunch snacks", "Snacks & Candy"); add("Juice boxes", "Beverages"); }
    if (/soccer|practice|game|sports|gym/.test(title)) { add("Sports drinks", "Beverages"); add("Granola bars", "Snacks & Candy"); }
    if (/birthday|party|gift/.test(title)) { add("Birthday card", "Other"); add("Gift wrap", "Paper & Disposable"); }
    if (/dentist|doctor|pharmacy|medicine/.test(title)) add("Toothpaste", "Health & Personal Care");
  }
  return items.slice(0, 10);
}

function calendarTaskSuggestions(events = [], tasks = [], members = []) {
  const today = todayISO();
  const existing = new Set(tasks.filter((task) => !task.done).map((task) => compactName(task.title)));
  const actions = [];
  const add = (event, title, offsetDays = -1) => {
    const key = compactName(title);
    if (!key || existing.has(key)) return;
    existing.add(key);
    const eventDate = event.start?.slice(0, 10) || today;
    const due = addDays(eventDate, offsetDays);
    actions.push({
      id: `event-task-${actions.length}`,
      type: "add_task",
      args: {
        title,
        due_date: due < today ? today : due,
        assignee_name: members[0]?.name || "",
        task_type: "family",
      },
    });
  };

  events
    .filter((event) => event.start?.slice(0, 10) >= today)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 12)
    .forEach((event) => {
      const title = compactName(event.title);
      if (/soccer|practice|game|sports/.test(title)) add(event, `Pack bag for ${event.title}`);
      if (/birthday|party/.test(title)) add(event, `Buy gift for ${event.title}`);
      if (/dentist|doctor|appointment|medical/.test(title)) add(event, `Confirm ${event.title}`);
      if (/school|teacher|conference|field trip/.test(title)) add(event, `Prepare for ${event.title}`);
      if (/dinner|lunch|brunch|meal/.test(title)) add(event, `Plan food for ${event.title}`);
      if (event.location && !/home/i.test(event.location)) add(event, `Check travel time to ${event.location}`, 0);
    });

  return uniqueActions(actions).slice(0, 8);
}

function mealActionsFromGroceries(groceryList = []) {
  return suggestMealsFromGroceries(groceryList, 5).slice(0, 4).map((recipe, index) => ({
    id: `meal-${recipe.id}-${index}`,
    type: "plan_meal",
    args: {
      date: addDays(todayISO(), index),
      slot: "dinner",
      title: recipe.title,
      notes: `Suggested from groceries · ${recipe.tags.slice(0, 4).join(", ")}`,
      cook_names: [],
    },
  }));
}

function groceryActionsFromMeals(mealList = [], groceryList = []) {
  return groceryItemsForMealPlan(mealList.filter((meal) => meal.date >= todayISO()), groceryList)
    .slice(0, 12)
    .map((item, index) => ({ id: `grocery-${index}`, type: "add_grocery", args: item }));
}

async function getFunctionError(invokeError) {
  try {
    const response = invokeError?.context;
    if (response?.clone) {
      const payload = await response.clone().json();
      if (payload?.error) return payload.error;
    }
  } catch {
    // Supabase does not always expose a JSON response for network failures.
  }

  return "Fam AI is not connected yet. The FamOS admin needs to finish the server setup.";
}

export default function FamAI() {
  const { configured } = useAuth();
  const {
    members,
    tasks,
    groceries,
    events,
    googleEvents,
    feedEvents,
    meals,
    expenses,
    weeklyBudget,
    monthlyBudget,
    financePeriod,
    addTask,
    addGrocery,
    addEvent,
    setMealForSlot,
  } = useFamily();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi, I’m Fam AI. Tell me what you need and I’ll suggest the next step.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const memberId = (name) =>
    members.find((member) =>
      member.name.toLowerCase().includes((name || "").toLowerCase()),
    )?.id ||
    members[0]?.id ||
    null;

  const buildDaisyChainFollowUp = (approvedActions) => {
    const allEvents = [...(events || []), ...(googleEvents || []), ...(feedEvents || [])];
    const addedGroceries = approvedActions
      .filter((action) => action.type === "add_grocery")
      .map((action) => ({
        ...(action.args || {}),
        checked: false,
      }));
    const addedMeals = approvedActions
      .filter((action) => action.type === "plan_meal")
      .map((action) => ({
        date: action.args?.date,
        slot: action.args?.slot || "dinner",
        title: action.args?.title,
        notes: action.args?.notes || "",
      }))
      .filter((meal) => meal.date && meal.title);
    const addedTasks = approvedActions
      .filter((action) => action.type === "add_task")
      .map((action) => ({
        title: action.args?.title,
        due: action.args?.due_date,
        done: false,
        taskType: action.args?.task_type || "home",
      }))
      .filter((task) => task.title);
    const addedEvents = approvedActions
      .filter((action) => action.type === "add_event")
      .map((action) => ({
        title: action.args?.title,
        start: action.args?.start,
        end: action.args?.end,
        location: action.args?.location || "",
      }))
      .filter((event) => event.title && event.start);

    if (addedGroceries.length) {
      const nextMeals = mealActionsFromGroceries([...groceries, ...addedGroceries]);
      if (nextMeals.length) {
        return {
          message: "Since we touched the grocery list, I also found dinners you can make from those items. Want me to add these to the meal planner?",
          actions: nextMeals,
        };
      }
    }

    if (addedMeals.length) {
      const nextGroceries = groceryActionsFromMeals([...meals, ...addedMeals], groceries);
      if (nextGroceries.length) {
        return {
          message: "I can also build the missing grocery list for those planned meals. Review the items below.",
          actions: nextGroceries,
        };
      }
    }

    if (addedTasks.length) {
      const nextGroceries = taskStoreSuggestions([...tasks, ...addedTasks], groceries);
      if (nextGroceries.length) {
        return {
          message: "A few store items may help with those tasks. Review the suggestions below.",
          actions: nextGroceries,
        };
      }
    }

    if (addedEvents.length) {
      const nextTasks = calendarTaskSuggestions([...allEvents, ...addedEvents], tasks, members);
      if (nextTasks.length) {
        return {
          message: "I also spotted prep tasks from the calendar. Want me to add them?",
          actions: nextTasks,
        };
      }
    }

    return null;
  };

  const sendText = async (text, displayText = text) => {
    if (!text || busy) return;

    setInput("");
    const nextUserMessage = { role: "user", content: displayText, aiContent: text };
    const nextMessages = [...messages, nextUserMessage];
    setMessages((current) => [...current, nextUserMessage]);
    setBusy(true);
    setError("");

    try {
      const allEvents = [...(events || []), ...(googleEvents || []), ...(feedEvents || [])];
      const projectedGroceries = [
        ...groceries,
        ...pending
          .filter((action) => action.type === "add_grocery")
          .map((action) => ({ ...(action.args || {}), checked: false })),
      ];
      const projectedMeals = [
        ...meals,
        ...pending
          .filter((action) => action.type === "plan_meal")
          .map((action) => ({
            date: action.args?.date,
            slot: action.args?.slot || "dinner",
            title: action.args?.title,
            notes: action.args?.notes || "",
          }))
          .filter((meal) => meal.date && meal.title),
      ];
      const projectedTasks = [
        ...tasks,
        ...pending
          .filter((action) => action.type === "add_task")
          .map((action) => ({
            title: action.args?.title,
            due: action.args?.due_date,
            done: false,
            taskType: action.args?.task_type || "home",
          }))
          .filter((task) => task.title),
      ];
      const projectedEvents = [
        ...allEvents,
        ...pending
          .filter((action) => action.type === "add_event")
          .map((action) => ({
            title: action.args?.title,
            start: action.args?.start,
            end: action.args?.end,
            location: action.args?.location || "",
          }))
          .filter((event) => event.title && event.start),
      ];

      if (wantsStoreItemsFromTasks(text)) {
        const storeActions = taskStoreSuggestions(projectedTasks, projectedGroceries);
        setMessages((current) => [...current, {
          role: "assistant",
          content: storeActions.length
            ? "I found store items that support your open task list. Review these before I add them to groceries."
            : "I checked the current task list and don’t see any obvious store items to add yet.",
        }]);
        setPending(storeActions);
        return;
      }

      if (wantsTasksFromCalendar(text)) {
        const taskActions = calendarTaskSuggestions(projectedEvents, projectedTasks, members);
        setMessages((current) => [...current, {
          role: "assistant",
          content: taskActions.length
            ? "I found prep tasks from your upcoming calendar events. Review these before I add them."
            : "I checked your upcoming calendar and don’t see any obvious prep tasks to create yet.",
        }]);
        setPending(taskActions);
        return;
      }

      if (wantsBusiestDayAnswer(text)) {
        const answer = analyzeBusiestDay({ events: projectedEvents, tasks: projectedTasks, meals: projectedMeals, members });
        setMessages((current) => [...current, { role: "assistant", content: answer }]);
        setPending([]);
        return;
      }

      if (wantsGroceryList(text) && projectedMeals.some((meal) => meal.title)) {
        const missingActions = groceryActionsFromMeals(projectedMeals, projectedGroceries);
        const mealIdeas = suggestMealsFromGroceries(projectedGroceries, 3).map((recipe) => recipe.title);
        setMessages((current) => [...current, {
          role: "assistant",
          content: missingActions.length
            ? `I built a grocery list from your planned meals. I also checked what is already on your grocery list${mealIdeas.length ? ` and found meal ideas you could make from it: ${mealIdeas.join(", ")}.` : "."}\n\nReview the grocery items below before I add them.`
            : `Your planned meals already look covered by the current grocery list.${mealIdeas.length ? ` Based on what you have listed, you could also make: ${mealIdeas.join(", ")}.` : ""}`,
        }]);
        setPending(missingActions);
        return;
      }

      if (wantsMealIdeas(text) && projectedGroceries.some((item) => !item.checked)) {
        const mealActions = mealActionsFromGroceries(projectedGroceries);
        if (mealActions.length) {
          setMessages((current) => [...current, {
            role: "assistant",
            content: `Based on your current grocery list, I found meal ideas that use what you already have: ${mealActions.map((action) => action.args.title).join(", ")}.\n\nReview the meal-plan actions below and I can add them to the next open dinner slots.`,
          }]);
          setPending(mealActions);
          return;
        }
      }

      if (!configured || !supabase) {
        throw new Error("Fam AI needs the FamOS cloud connection before it can respond.");
      }

      const { data, error: invokeError } = await supabase.functions.invoke("fam-ai", {
        body: {
          messages: nextMessages.map(
            ({ role, content, aiContent }) => ({ role, content: aiContent || content }),
          ),
          context: {
            today: todayISO(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            family: members.map((member) => member.name),
            members: members.map((member) => ({ id: member.id, name: member.name, role: member.role })),
            tasks: projectedTasks.map((task) => ({
              title: task.title,
              due: task.due,
              done: task.done,
              assignee: task.assigneeId ? members.find((member) => member.id === task.assigneeId)?.name : null,
              taskType: task.taskType,
            })),
            openTasks: projectedTasks.filter((task) => !task.done).map((task) => ({
              title: task.title,
              due: task.due,
              assignee: task.assigneeId ? members.find((member) => member.id === task.assigneeId)?.name : null,
              taskType: task.taskType,
            })),
            groceries: projectedGroceries
              .filter((item) => !item.checked)
              .map((item) => ({ name: item.name, category: item.category, quantity: item.quantity, unit: item.unit })),
            upcomingEvents: projectedEvents
              .filter((item) => item.start && item.start >= new Date(`${todayISO()}T00:00:00`).toISOString())
              .sort((a, b) => a.start.localeCompare(b.start))
              .slice(0, 50)
              .map((item) => ({ title: item.title, start: item.start, end: item.end, location: item.location, source: item.source })),
            plannedMeals: projectedMeals
              .filter((item) => item.date >= todayISO())
              .slice(0, 42)
              .map((item) => ({ date: item.date, slot: item.slot, title: item.title, notes: item.notes })),
            mealGroceryBridge: {
              pendingActions: pending.map((action) => ({ type: action.type, args: action.args })),
              missingGroceriesForMeals: groceryItemsForMealPlan(projectedMeals.filter((item) => item.date >= todayISO()), projectedGroceries).slice(0, 20),
              mealIdeasFromGroceries: suggestMealsFromGroceries(projectedGroceries, 8).map((recipe) => ({
                title: recipe.title,
                cuisine: recipe.cuisine,
                ingredients: recipe.tags,
              })),
            },
            finance: {
              financePeriod,
              weeklyBudget,
              monthlyBudget,
              recentExpenses: expenses
                .slice(0, 12)
                .map((item) => ({
                  description: item.description,
                  amount: item.amount,
                  category: item.category,
                  spentOn: item.spentOn,
                })),
            },
          },
        },
      });

      if (invokeError) throw new Error(await getFunctionError(invokeError));
      if (data?.error) throw new Error(data.error);

      setMessages((current) => [
        ...current,
        { role: "assistant", content: data?.message || "I’m ready to help." },
      ]);
      setPending(data?.actions || []);
    } catch (requestError) {
      setError(requestError.message || "Fam AI could not respond.");
    } finally {
      setBusy(false);
    }
  };

  const send = async (event) => {
    event.preventDefault();
    await sendText(input.trim());
  };

  const handleComposerKeyDown = async (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    await sendText(input.trim());
  };

  const execute = async () => {
    setBusy(true);
    setError("");
    const approvedActions = pending;
    try {
      for (const action of approvedActions) {
        const args = action.args || {};
        if (action.type === "add_task") {
          await addTask({
            title: args.title,
            assigneeId: memberId(args.assignee_name),
            due: args.due_date,
            taskType: args.task_type || "home",
            recurring: "",
          });
        }
        if (action.type === "add_grocery") {
          await addGrocery({
            name: args.name,
            category: args.category || "Other",
            quantity: Number(args.quantity || 1),
            unit: args.unit || "",
          });
        }
        if (action.type === "add_event") {
          await addEvent({
            title: args.title,
            start: args.start,
            end: args.end,
            location: args.location || "",
            memberIds: (args.member_names || []).map(memberId).filter(Boolean),
          });
        }
        if (action.type === "plan_meal") {
          await setMealForSlot(args.date, args.slot, {
            title: args.title,
            notes: args.notes || "",
            cookIds: (args.cook_names || []).map(memberId).filter(Boolean),
          });
        }
      }

      const followUp = buildDaisyChainFollowUp(approvedActions);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Done — I added ${approvedActions.length} approved action${approvedActions.length === 1 ? "" : "s"} to FamOS.${followUp ? `\n\n${followUp.message}` : ""}`,
        },
      ]);
      setPending(followUp?.actions || []);
    } catch (actionError) {
      setError(actionError.message || "An action could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-20 fam-ai-page">
      <PageHeader
        eyebrow="Your family assistant"
        title="Fam AI"
        illustration="famai"
        subtitle="Get help planning meals, groceries, tasks, and schedules."
      />
      <div className="px-5">
        <div className="fam-ai-use-cases">
          <div className="fam-ai-shortcut-title">
            <span>
              <Sparkles />
              Ask Fam AI
            </span>
            <em>Beta</em>
          </div>
          <div className="fam-ai-chips">
            {prompts.map((prompt) => {
              const Icon = prompt.Icon;
              return (
                <button
                  className={prompt.tone}
                  key={prompt.text}
                  onClick={() => sendText(prompt.prompt, prompt.text)}
                  disabled={busy}
                  type="button"
                >
                  <i>
                    <Icon />
                  </i>
                  <span>{prompt.text}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Card className="fam-ai-thread">
          {messages.map((message, index) => (
            <div key={index} className={`fam-ai-message ${message.role}`}>
              {message.role === "assistant" ? (
                <span className="fam-ai-avatar">
                  <Bot />
                </span>
              ) : (
                <Avatar member={members[0]} />
              )}
              <p>{message.content}</p>
            </div>
          ))}
          {busy && (
            <div className="fam-ai-thinking">
              <i />
              <i />
              <i />
            </div>
          )}
        </Card>

        {pending.length > 0 && (
          <Card className="fam-ai-review">
            <div className="fam-ai-review-title">
              <div>
                <Sparkles />
                <span>
                  <strong>Review actions</strong>
                  <small>Nothing changes until you approve.</small>
                </span>
              </div>
              <button onClick={() => setPending([])} aria-label="Dismiss actions">
                <X />
              </button>
            </div>
            {pending.map((action) => {
              const meta = actionMeta[action.type] || actionMeta.add_task;
              const Icon = meta.Icon;
              return (
                <div className="fam-ai-action" key={action.id}>
                  <span>
                    <Icon />
                  </span>
                  <div>
                    <strong>{meta.label}</strong>
                    <small>{actionSummary(action)}</small>
                  </div>
                </div>
              );
            })}
            <div className="fam-ai-review-buttons">
              <SecondaryButton onClick={() => setPending([])}>Cancel</SecondaryButton>
              <PrimaryButton onClick={execute} disabled={busy}>
                Approve & run
              </PrimaryButton>
            </div>
          </Card>
        )}

        {error && <p className="fam-ai-error">{error}</p>}

        <form className="fam-ai-compose" onSubmit={send}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Paste the messy thought here…"
            rows="2"
          />
          <button disabled={!input.trim() || busy} aria-label="Send">
            <Send />
          </button>
        </form>
        <p className="fam-ai-privacy">
          Fam AI suggests actions and asks before changing FamOS.
        </p>
      </div>
    </div>
  );
}
