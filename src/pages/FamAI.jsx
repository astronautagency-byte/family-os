import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  CalendarDays,
  Check,
  CheckSquare,
  ChefHat,
  ChevronDown,
  RotateCcw,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useFamily } from "../context/FamilyContext";
import { Avatar } from "../components/ui";
import useKitchenInventory from "../hooks/useKitchenInventory";
import { isCookableTonight } from "../lib/cookableTonight";
import { todayISO } from "../lib/dates";
import { supabase } from "../lib/supabase";
import { useFeatureFlag } from "../hooks/useFeatureFlag";
import { handleAskFam, getSuggestedPrompts, getSuggestedActions, riskLabel } from "../lib/famai";
import { undoAction, executeAction } from "../lib/famai/actions";

const actionMeta = {
  add_task: { label: "Create task", Icon: CheckSquare },
  add_grocery: { label: "Add grocery", Icon: ShoppingCart },
  add_event: { label: "Add event", Icon: CalendarDays },
  plan_meal: { label: "Plan meal", Icon: ChefHat },
};

const actionSummary = (action) => action.args?.title || action.args?.name || "New item";

const INITIAL_FAM_AI_MESSAGE = {
  role: "assistant",
  content: "Hi, I’m Fam AI. Ask me to add to a list, check the schedule, or get the family ready — I’ll handle the household side and show you exactly what I do before it happens.",
};

export default function FamAI({ open: propOpen, onClose, screen = "" }) {
  const { configured, household, user } = useAuth();
  const {
    members,
    tasks,
    groceries,
    events,
    googleEvents,
    feedEvents,
    meals,
    addTask,
    addGrocery,
    addEvent,
    updateEvent,
    removeEvent,
    toggleTask,
    toggleGrocery,
    removeGrocery,
    setMealForSlot,
    currentUserId,
  } = useFamily();

  const [messages, setMessages] = useState([INITIAL_FAM_AI_MESSAGE]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState([]);
  const [error, setError] = useState("");
  const chatRef = useRef(null);
  // When the router asks a clarification question, the next user message is
  // merged back into the original request (e.g. "add soccer game at 10" +
  // "saturday" → "add soccer game at 10 saturday") so the router can finish.
  const pendingClarifyRef = useRef(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = propOpen !== undefined;
  const open = controlled ? propOpen : internalOpen;
  const setOpen = (next) => {
    if (controlled) {
      if (!next) onClose?.();
      return;
    }
    setInternalOpen(next);
  };
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const memberId = (name) =>
    members.find((member) =>
      member.name.toLowerCase().includes((name || "").toLowerCase()),
    )?.id ||
    members[0]?.id ||
    null;

  // The api object the deterministic action layer executes through — the
  // only writes Fam AI ever performs are these scoped context functions.
  const api = {
    members,
    groceries,
    tasks,
    events,
    addGrocery,
    removeGrocery,
    toggleGrocery,
    addTask,
    toggleTask,
    addEvent,
    updateEvent,
    removeEvent,
    currentUserId,
  };

  const { items: kitchenWatchItems } = useKitchenInventory(household?.id, user?.id);

  const stateSnapshot = () => ({
    members,
    groceries,
    tasks,
    events,
    meals,
    kitchenWatch: kitchenWatchItems,
    today: todayISO(),
  });

  // Rich message render helpers — each message can carry structured payloads
  // (preview / clarify / execute / refused) on top of the plain text.
  const appendAssistant = (payload) => setMessages((current) => [...current, payload]);

  const sendText = async (text, displayText = text) => {
    if (!text || busy) return;
    setInput("");
    // Merge clarification answers into the original request.
    const clarify = pendingClarifyRef.current;
    const effectiveText = clarify ? `${clarify.originalText} ${text}` : text;
    const effectiveDisplay = clarify ? text : displayText;
    pendingClarifyRef.current = null;
    setMessages((current) => [...current, { role: "user", content: effectiveDisplay, aiContent: effectiveText }]);
    setBusy(true);
    setError("");

    try {
      const result = await handleAskFam(text, {
        state: stateSnapshot(),
        api,
      });

      switch (result.kind) {
        case "answer":
          appendAssistant({ role: "assistant", content: result.text });
          break;
        case "refused":
          appendAssistant({ role: "assistant", content: result.text, refused: result.level });
          break;
        case "execute":
          appendAssistant({
            role: "assistant",
            content: result.message,
            executed: true,
            undo: result.undo || [],
            canUndo: !!result.canUndo,
            action: result.action,
          });
          break;
        case "clarify":
          pendingClarifyRef.current = { originalText: text, intent: result.intent, entities: result.entities };
          appendAssistant({
            role: "assistant",
            content: result.question,
            clarify: true,
            intent: result.intent,
            entities: result.entities,
            confidence: result.confidence,
          });
          break;
        case "preview":
          appendAssistant({
            role: "assistant",
            content: result.message,
            preview: result.action,
            confidence: result.confidence,
            risk: result.risk,
          });
          break;
        case "needsAi":
          await askTheCloud(text);
          break;
        default:
          await askTheCloud(text);
      }
    } catch (requestError) {
      setError(requestError.message || "Fam AI could not respond.");
    } finally {
      setBusy(false);
    }
  };

  // LLM fallback — only reached when the deterministic router can't resolve.
  // Sends the COMPACT household context (never full history).
  const askTheCloud = async (text) => {
    if (!configured || !supabase) {
      appendAssistant({ role: "assistant", content: "Fam AI needs the FamOS cloud connection before it can respond to that. The household assistant can still handle list, schedule, task and grocery requests offline." });
      return;
    }
    const allEvents = [...(events || []), ...(googleEvents || []), ...(feedEvents || [])];
    const { data, error: invokeError } = await supabase.functions.invoke("fam-ai", {
      body: {
        messages: [...messages.map((m) => ({ role: m.role, content: m.aiContent || m.content })), { role: "user", content: text }],
        context: {
          today: todayISO(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          screen,
          family: members.map((member) => member.name),
          members: members.map((member) => ({ id: member.id, name: member.name, role: member.role })),
          tasks: tasks.filter((task) => !task.done).slice(0, 40).map((task) => ({ title: task.title, due: task.due, assignee: task.assigneeId ? members.find((m) => m.id === task.assigneeId)?.name : null, taskType: task.taskType })),
          groceries: groceries.filter((item) => !item.checked).slice(0, 60).map((item) => ({ name: item.name, category: item.category, quantity: item.quantity, unit: item.unit })),
          upcomingEvents: allEvents
            .filter((item) => item.start && item.start >= new Date(`${todayISO()}T00:00:00`).toISOString())
            .sort((a, b) => a.start.localeCompare(b.start))
            .slice(0, 50)
            .map((item) => ({ title: item.title, start: item.start, end: item.end, location: item.location, source: item.source })),
          plannedMeals: meals.filter((item) => item.date >= todayISO()).slice(0, 42).map((item) => ({ date: item.date, slot: item.slot, title: item.title, notes: item.notes })),
          kitchenWatch: (kitchenWatchItems || []).slice(0, 30).map((item) => ({ name: item.name, category: item.category, expiry_date: item.expiresOn, quantity: item.quantity, location: item.location })),
          pendingActions: pending.map((action) => ({ type: action.type, args: action.args })),
        },
      },
    });
    if (invokeError) throw new Error(await getFunctionError(invokeError));
    if (data?.error) throw new Error(data.error);
    appendAssistant({ role: "assistant", content: data?.message || "I’m ready to help." });
    setPending(Array.isArray(data?.actions) ? data.actions : []);
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

  // Approve a previewed action.
  const approvePreview = async (messageIndex) => {
    const message = messages[messageIndex];
    if (!message?.preview) return;
    setBusy(true);
    setError("");
    try {
      const result = await executePreview(message.preview, api);
      if (result.ok) {
        setMessages((current) => current.map((m, i) => i === messageIndex ? { ...m, preview: null, executed: true, undo: result.undo || [], canUndo: !!result.canUndo, content: result.message } : m));
      } else {
        setError(result.message);
      }
    } catch (actionError) {
      setError(actionError.message || "That action could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const executePreview = (preview, executeApi) => executeAction(preview.intent, preview.entities, executeApi);

  const undoMessage = async (messageIndex) => {
    const message = messages[messageIndex];
    if (!message?.undo?.length) return;
    setBusy(true);
    setError("");
    try {
      for (const actionId of message.undo) {
        await undoAction(actionId, api);
      }
      setMessages((current) => current.map((m, i) => i === messageIndex ? { ...m, undone: true, canUndo: false, undo: [] } : m));
    } catch (actionError) {
      setError(actionError.message || "Could not undo that action.");
    } finally {
      setBusy(false);
    }
  };

  // LLM-generated action execution (the review panel path).
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
      appendAssistant({
        role: "assistant",
        content: `Done — I added ${approvedActions.length} approved action${approvedActions.length === 1 ? "" : "s"} to FamOS.`,
      });
      setPending([]);
    } catch (actionError) {
      setError(actionError.message || "An action could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const [cookableEnabled] = useFeatureFlag("cookable-soft-tier");
  const cookablePlanMealActions = pending.filter((action) =>
    action.type === "plan_meal"
    && Array.isArray(action.args?.ingredients)
    && isCookableTonight({ ingredients: action.args.ingredients }, groceries)
  );
  const cookablePlanMealIds = new Set(cookablePlanMealActions.map((action) => action.id));
  const primaryPending = pending.filter((action) => !cookablePlanMealIds.has(action.id));
  const welcomeState = messages.length === 1 && !busy && pending.length === 0;

  const suggestedPrompts = getSuggestedPrompts(stateSnapshot(), screen);
  const suggestedActions = getSuggestedActions(stateSnapshot());

  const sheet = (
    <div className="fam-ai-sheet" role="dialog" aria-modal="true" aria-label="Fam AI assistant">
      <button
        className="fam-ai-sheet-close"
        onClick={() => setOpen(false)}
        aria-label="Close Fam AI"
        type="button"
      >
        <X size={18} />
      </button>
      <div className="fam-ai-page famos-noscroll">
        <main className={`fam-ai-workspace ${welcomeState ? "is-welcome" : ""}`}>
        <div className="fam-ai-header">
          <div className="fam-ai-header-inner">
            <div className="fam-ai-brand">
              <span className="fam-ai-brand-icon"><Sparkles size={16} /></span>
              <div className="fam-ai-brand-copy"><strong>Fam AI</strong><span><i /> Household assistant</span></div>
              <em>Beta</em>
            </div>
            <p className="fam-ai-header-tagline">Ask naturally. Fam AI proposes changes for your review — nothing changes without you.</p>
          </div>
        </div>

      {welcomeState && <div className="fam-ai-welcome"><h2>What can I help with?</h2><p>Ask Fam anything about your family’s day — lists, schedule, meals and more. I resolve what I can instantly and only reach for the cloud when needed.</p></div>}

      <div className="fam-ai-chat" ref={chatRef}>
        {!welcomeState && messages.map((message, index) => (
          <div key={index} className={`fam-ai-msg ${message.role}`}>
            <div className="fam-ai-msg-row">
              {message.role === "assistant" ? (
                <span className="fam-ai-msg-avatar"><Bot size={15} /></span>
              ) : (
                <Avatar member={members[0]} size="sm" className="fam-ai-msg-avatar user" />
              )}
              <div className="fam-ai-msg-body">
                {message.role === "assistant" && <div className="fam-ai-msg-meta"><strong>Fam AI</strong><span>Household assistant</span></div>}
                <p className={message.role === "assistant" ? "fam-ai-msg-bubble" : "fam-ai-msg-bubble user"}>{message.content}</p>

                {message.preview && (
                  <div className="fam-ai-preview-card">
                    <div className="fam-ai-preview-head">
                      <span className="fam-ai-preview-badge"><Sparkles size={12} /> Ready to run</span>
                      {message.risk !== undefined && <em>{riskLabel(message.risk)}</em>}
                    </div>
                    <div className="fam-ai-preview-actions">
                      <button className="fam-ai-preview-approve" onClick={() => approvePreview(index)} disabled={busy} type="button">
                        <Check size={14} /> Confirm
                      </button>
                      <button className="fam-ai-preview-cancel" onClick={() => setMessages((current) => current.map((m, i) => i === index ? { ...m, preview: null } : m))} type="button">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {message.executed && message.canUndo && !message.undone && (
                  <div className="fam-ai-undo-chip">
                    <span><Check size={12} /> Done</span>
                    <button onClick={() => undoMessage(index)} disabled={busy} type="button">
                      <RotateCcw size={12} /> Undo
                    </button>
                  </div>
                )}
                {message.executed && message.undone && (
                  <div className="fam-ai-undo-chip undone"><span><RotateCcw size={12} /> Undone</span></div>
                )}

                {message.clarify && (
                  <p className="fam-ai-clarify-hint">Just reply with the missing detail — e.g. “Saturday” or “6pm”.</p>
                )}
              </div>
            </div>
          </div>
        ))}

        {busy && (
          <div className="fam-ai-msg assistant">
            <div className="fam-ai-msg-row">
              <span className="fam-ai-msg-avatar"><Bot size={15} /></span>
              <div className="fam-ai-msg-body">
                <div className="fam-ai-thinking"><i /><i /><i /></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {welcomeState && !busy && (
        <div className="fam-ai-suggestions">
          <p className="fam-ai-suggestions-label">Try asking</p>
          <div className="fam-ai-suggestion-grid">
            {suggestedPrompts.map((prompt) => (
              <button
                className={`fam-ai-suggestion ${prompt.tone || "calendar"}`}
                key={prompt.text}
                onClick={() => sendText(prompt.text)}
                disabled={busy}
                type="button"
              >
                <span className="fam-ai-suggestion-icon"><Sparkles size={16} /></span>
                <span className="fam-ai-suggestion-text">{prompt.text}</span>
              </button>
            ))}
          </div>
          {suggestedActions.length > 0 && (
            <div className="fam-ai-action-chips">
              {suggestedActions.map((action) => (
                <button key={action.id} onClick={() => sendText(action.prompt)} disabled={busy} type="button">
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {pending.length > 0 && (
        <div className="fam-ai-review">
          <div className="fam-ai-review-head">
            <span className="fam-ai-review-head-label"><Sparkles size={14} /><strong>Review actions</strong></span>
            <button className="fam-ai-review-close" onClick={() => setPending([])} aria-label="Dismiss"><X size={14} /></button>
          </div>
          <p className="fam-ai-review-note">Nothing changes until you approve.</p>
          <>
            <div className="fam-ai-review-list">
              {primaryPending.map((action) => {
                const meta = actionMeta[action.type] || actionMeta.add_task;
                const Icon = meta.Icon;
                return (
                  <div className="fam-ai-review-item" key={action.id}>
                    <span className="fam-ai-review-item-icon"><Icon size={14} /></span>
                    <div className="fam-ai-review-item-text">
                      <strong>{meta.label}</strong>
                      <small>{actionSummary(action)}</small>
                    </div>
                  </div>
                );
              })}
            </div>
            {cookableEnabled && cookablePlanMealActions.length > 0 && (
              <details className="famos-soft-tier meal-soft-tier">
                <summary>
                  <ChevronDown aria-hidden="true" size={14} />
                  <div>
                    <strong><ShoppingBasket aria-hidden="true" size={13} /> {cookablePlanMealActions.length} you can cook tonight</strong>
                    <small>tap to peek — every ingredient is already in your pantry</small>
                  </div>
                </summary>
                <ul className="fam-ai-review-list fam-ai-meal-list mt-2">
                  {cookablePlanMealActions.map((action) => {
                    const Icon = (actionMeta[action.type] || actionMeta.add_task).Icon;
                    return (
                      <li className="fam-ai-review-item" key={action.id}>
                        <span className="fam-ai-review-item-icon"><Icon size={14} /></span>
                        <div className="fam-ai-review-item-text">
                          <strong>Plan meal <Check aria-hidden="true" size={11} /></strong>
                          <small>{actionSummary(action)}</small>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </>
          <div className="fam-ai-review-actions">
            <button className="fam-ai-review-cancel" onClick={() => setPending([])}>Cancel</button>
            <button className="fam-ai-review-approve" onClick={execute} disabled={busy}>Approve & run</button>
          </div>
        </div>
      )}

      {error && <p className="fam-ai-error">{error}</p>}

      <form className="fam-ai-composer" onSubmit={send}>
        <div className="fam-ai-composer-inner">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Ask everything…"
            rows="1"
          />
          <div className="fam-ai-composer-tools">
            <span className="fam-ai-composer-tool"><Wrench size={12} /> Tools <ChevronDown size={11} /></span>
            <span className="fam-ai-composer-tool fam-ai-composer-model"><Sparkles size={12} /> Fam AI <ChevronDown size={11} /></span>
            <span className="fam-ai-composer-context"><ShieldCheck size={12} /> Private to your household</span>
            <span className="fam-ai-composer-spacer" />
            <button className="fam-ai-composer-send" disabled={!input.trim() || busy} aria-label="Send message">
              <ArrowUp size={17} />
            </button>
          </div>
        </div>
        {!welcomeState && <div className="fam-ai-composer-foot"><span><Sparkles size={11}/> Ask naturally</span><p>Deterministic first — only complex requests reach the cloud.</p><kbd>↵ Send · ⇧↵ New line</kbd></div>}
      </form>
      </main>
      </div>
    </div>
  );

  return (
    <>
      {open && (
        <>
          <button
            type="button"
            className="fam-ai-sheet-backdrop"
            onClick={() => setOpen(false)}
            aria-label="Close Fam AI"
          />
          {sheet}
        </>
      )}
    </>
  );
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
