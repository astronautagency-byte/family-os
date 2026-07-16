import { useState } from "react";
import {
  Bot,
  CalendarDays,
  CheckSquare,
  ChefHat,
  Send,
  ShoppingCart,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import { Avatar, Card, PrimaryButton, SecondaryButton } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useFamily } from "../context/FamilyContext";
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
      "Use the current FamilyOS household context and prepare a balanced chore plan for this week. Create 3 to 5 task actions, spread them across available family members, due over the next 7 days, with task_type set to home or errand. If there are no obvious chores already listed, use practical defaults like tidy bedrooms, take out trash, fold laundry, clear dishes, water plants, or feed pets. Make reasonable choices for review instead of asking follow-up questions unless there are no family members.",
  },
  {
    label: "Meals",
    tone: "meals",
    Icon: ChefHat,
    text: "Plan easy dinners",
    prompt:
      "Use the current FamilyOS meal and grocery context to plan five easy family dinners over the next 7 days. Create plan_meal actions for dinner slots with short helpful notes. Prefer low-prep, family-friendly meals and avoid duplicating meals already planned. If there are no constraints, choose balanced defaults and prepare them for review.",
  },
  {
    label: "Calendar",
    tone: "calendar",
    Icon: CalendarDays,
    text: "Find our busiest day",
    prompt:
      "Use the current FamilyOS calendar, task, and meal context to identify the busiest day in the next 7 days. Count events, due tasks, and planned meals. Give a concise answer with the busiest day, why it is busy, and one practical suggestion to make the day easier. Do not ask follow-up questions unless there is no schedule data at all.",
  },
  {
    label: "Groceries",
    tone: "groceries",
    Icon: ShoppingCart,
    text: "Build a shopping list",
    prompt:
      "Use the current FamilyOS meal plan and grocery context to prepare a useful shopping list. Add only missing grocery items as add_grocery actions and avoid duplicates already on the unchecked list. If no meals are planned, create a sensible starter list for five easy family dinners, grouped by common grocery categories. Prepare the items for review instead of asking follow-up questions.",
  },
  {
    label: "Finance",
    tone: "finance",
    Icon: Wallet,
    text: "Check this week's budget",
    prompt:
      "Use the current FamilyOS finance context to check whether the household is on track for the active budget period. Compare recent expenses with the weekly or monthly budget, mention what is left, flag any category that looks high, and suggest one practical adjustment. Do not ask follow-up questions unless no budget or expense data exists.",
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

  return "Fam AI is not connected yet. The FamilyOS administrator needs to finish the server setup.";
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
      content: "Hi! I’m Fam AI. Ask me to organize chores, groceries, events, or meals.",
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
      if (wantsBusiestDayAnswer(text)) {
        const answer = analyzeBusiestDay({ events: allEvents, tasks, meals, members });
        setMessages((current) => [...current, { role: "assistant", content: answer }]);
        setPending([]);
        return;
      }

      if (!configured || !supabase) {
        throw new Error("Fam AI needs the FamilyOS cloud connection before it can respond.");
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
            tasks: tasks.map((task) => ({
              title: task.title,
              due: task.due,
              done: task.done,
              assignee: task.assigneeId ? members.find((member) => member.id === task.assigneeId)?.name : null,
              taskType: task.taskType,
            })),
            openTasks: tasks.filter((task) => !task.done).map((task) => ({
              title: task.title,
              due: task.due,
              assignee: task.assigneeId ? members.find((member) => member.id === task.assigneeId)?.name : null,
              taskType: task.taskType,
            })),
            groceries: groceries
              .filter((item) => !item.checked)
              .map((item) => ({ name: item.name, category: item.category, quantity: item.quantity, unit: item.unit })),
            upcomingEvents: allEvents
              .filter((item) => item.start && item.start >= new Date(`${todayISO()}T00:00:00`).toISOString())
              .sort((a, b) => a.start.localeCompare(b.start))
              .slice(0, 50)
              .map((item) => ({ title: item.title, start: item.start, end: item.end, location: item.location, source: item.source })),
            plannedMeals: meals
              .filter((item) => item.date >= todayISO())
              .slice(0, 42)
              .map((item) => ({ date: item.date, slot: item.slot, title: item.title, notes: item.notes })),
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

  const execute = async () => {
    setBusy(true);
    setError("");
    try {
      for (const action of pending) {
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

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Done — I added ${pending.length} approved action${pending.length === 1 ? "" : "s"} to FamilyOS.`,
        },
      ]);
      setPending([]);
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
        subtitle="Plan your family life in a conversation."
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
            placeholder="Ask Fam AI to organize something…"
            rows="2"
          />
          <button disabled={!input.trim() || busy} aria-label="Send">
            <Send />
          </button>
        </form>
        <p className="fam-ai-privacy">
          Fam AI can suggest actions, but always asks before changing FamilyOS.
        </p>
      </div>
    </div>
  );
}
