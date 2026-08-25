// Fam AI orchestrator. The single entry point the Ask Fam surface calls:
//
//   handleAskFam(text, { state, api, screen, member })
//
// Pipeline (PRD §7, deterministic-first):
//   1. Guardrails  — red/yellow/green + out-of-scope, before anything else
//   2. Intent router — deterministic intent + entities + confidence
//   3. Risk + confidence — execute directly (L1 + >=0.9), preview, or clarify
//   4. LLM fallback — only when the router returns null (needs reasoning)
//
// The caller owns the LLM call (it needs supabase + the edge function);
// this module returns an explicit `needsAi: true` marker when it can't
// resolve deterministically.

import { classifyRequest, isGeneralKnowledge, RISK, RED_RESPONSE, YELLOW_RESPONSE, OUT_OF_SCOPE_RESPONSE } from "./guardrails";
import { routeIntent, riskForIntent, shouldPreview } from "./intents";
import { executeAction } from "./actions";
import { answerGetSchedule, answerGetToday, answerGetList, answerGetDriver, answerGetConflicts, answerReadiness, answerGetMeals, answerGetKitchenWatch, answerGetGroceries, answerGetMealPlan } from "./context";
import { getSuggestedPrompts, getSuggestedActions } from "./suggestions";
import { buildCompactContext } from "./context";

export { getSuggestedPrompts, getSuggestedActions, buildCompactContext, RISK };

// Result shapes:
//   { kind: "answer", text }
//   { kind: "execute", message, undo, action }
//   { kind: "preview", intent, entities, confidence, message, action, risk }
//   { kind: "clarify", question, intent, entities, confidence }
//   { kind: "refused", text, level }
//   { kind: "needsAi" }
export async function handleAskFam(text, { state = {}, api = {} }) {
  const clean = (text || "").trim();
  if (!clean) return { kind: "needsAi" };

  // 1. Guardrails first — never send unauthorized or dangerous intents onward.
  const guard = classifyRequest(clean);
  if (guard.level === "red") return { kind: "refused", text: RED_RESPONSE, level: "red" };
  if (guard.level === "yellow") {
    // Yellow = limited assistance; still allow household operations that
    // happen to use the same words (e.g. "plan a healthy dinner").
    const routed = routeIntent(clean, { ...state, members: state.members });
    if (!routed) return { kind: "answer", text: YELLOW_RESPONSE };
  }
  if (isGeneralKnowledge(clean)) return { kind: "refused", text: OUT_OF_SCOPE_RESPONSE, level: "out_of_scope" };

  // 2. Deterministic intent routing.
  const route = routeIntent(clean, { ...state, members: state.members });
  if (!route) return { kind: "needsAi" };

  const risk = riskForIntent(route.intent);

  // Read intents answer directly from state — zero LLM cost.
  if (risk === RISK.READ) {
    switch (route.intent) {
      case "GET_SCHEDULE":
        return { kind: "answer", text: answerGetSchedule(route, state) };
      case "GET_TODAY":
        return { kind: "answer", text: answerGetToday(state) };
      case "GET_LIST":
        return { kind: "answer", text: answerGetList(state) };
      case "GET_DRIVER":
        return { kind: "answer", text: answerGetDriver(route, state) };
      case "GET_CONFLICTS":
        return { kind: "answer", text: answerGetConflicts(state) };
      case "GET_READINESS":
        return { kind: "answer", text: answerReadiness(state) };
      case "GET_MEALS":
        return { kind: "answer", text: answerGetMeals(state) };
      case "GET_MEAL_PLAN":
        return { kind: "answer", text: answerGetMealPlan(state) };
      case "GET_KITCHEN_WATCH":
        return { kind: "answer", text: answerGetKitchenWatch(state) };
      case "GET_GROCERIES":
        return { kind: "answer", text: answerGetGroceries(state) };
      default:
        return { kind: "needsAi" };
    }
  }

  // 3. Confidence + risk decide execute-vs-preview-vs-clarify.
  // Not-found reads that look like asks (e.g. "remove milk" but no match)
  // get a gentle clarify instead of a bare refusal.
  if (route.notFound && route.confidence < 0.7) {
    return {
      kind: "clarify",
      question: `I couldn't find "${route.entities?.name || "that"}" — did you mean something already on the list?`,
      intent: route.intent,
      entities: route.entities,
      confidence: route.confidence,
    };
  }

  if (route.confidence < 0.7) {
    return {
      kind: "clarify",
      question: clarifyQuestion(route),
      intent: route.intent,
      entities: route.entities,
      confidence: route.confidence,
      missing_fields: route.missing_fields || [],
    };
  }

  if (route.requires_confirmation || shouldPreview(route.intent, route.confidence)) {
    return {
      kind: "preview",
      intent: route.intent,
      entities: route.entities,
      confidence: route.confidence,
      risk,
      message: previewMessage(route),
      action: {
        intent: route.intent,
        entities: route.entities,
        confidence: route.confidence,
        requires_confirmation: route.requires_confirmation,
        missing_fields: route.missing_fields || [],
      },
    };
  }

  // 4. Low-risk, high-confidence: execute directly and offer Undo.
  const result = await executeAction(route.intent, route.entities, api);
  if (!result.ok) {
    return { kind: "clarify", question: result.message, intent: route.intent, entities: route.entities, confidence: route.confidence };
  }
  return {
    kind: "execute",
    message: result.message,
    undo: result.undo || [],
    canUndo: !!result.canUndo,
    action: { intent: route.intent, entities: route.entities },
  };
}

function clarifyQuestion(route) {
  const missing = route.missing_fields || [];
  if (missing.includes("date")) return "Which day did you mean?";
  if (missing.includes("start_time")) return "What time should that be?";
  if (missing.includes("title")) return "What should I call it?";
  if (missing.includes("event_id")) return "Which event did you mean — can you say its name?";
  if (missing.includes("task_id")) return "Which task should I complete?";
  if (missing.includes("member")) return "Who is that for?";
  return "Can you give me a bit more detail?";
}

function previewMessage(route) {
  switch (route.intent) {
    case "CREATE_EVENT": {
      const { title, date, start_time, memberName } = route.entities;
      return `Add "${title}"${date ? ` on ${date}` : ""}${start_time ? ` at ${start_time}` : ""}${memberName ? ` for ${memberName}` : ""}?`;
    }
    case "UPDATE_EVENT": {
      const { title, date, start_time } = route.entities;
      return `Move "${title || "this event"}" to ${date || "that day"}${start_time ? ` at ${start_time}` : ""}?`;
    }
    case "CANCEL_EVENT": {
      return `Cancel "${route.entities.title}" from the calendar? This can't be undone easily.`;
    }
    case "OFFER_DRIVE": {
      return route.entities.memberName
        ? `Mark you as the driver for ${route.entities.memberName}?`
        : "Mark you as the driver for this ride?";
    }
    case "ADD_LIST_ITEM": {
      const names = (route.entities.items || []).map((item) => item.name).join(", ");
      return `Add ${names} to the list?`;
    }
    default:
      return "Here's what I found — does this look right?";
  }
}

export function riskLabel(risk) {
  return { 0: "Read", 1: "Reversible", 2: "Needs review", 3: "High impact" }[risk] || "";
}
