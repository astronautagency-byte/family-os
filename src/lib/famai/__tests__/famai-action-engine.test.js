import { describe, it, expect } from "vitest";
import { handleAskFam } from "../index.js";
import { routeIntent } from "../intents.js";
import { classifyRequest, isGeneralKnowledge } from "../guardrails.js";
import { getSuggestedPrompts, getSuggestedActions } from "../suggestions.js";
import { todayISO } from "../../dates.js";

const members = [
  { id: "m1", name: "Alex" },
  { id: "m2", name: "Sarah" },
  { id: "m3", name: "Leo" },
  { id: "m4", name: "Sophia" },
];

function makeFixture() {
  const today = todayISO();
  const state = {
    members,
    groceries: [
      { id: "g1", name: "Milk", checked: false },
      { id: "g2", name: "Bananas", checked: false },
      { id: "g3", name: "Bread", checked: true },
    ],
    tasks: [{ id: "t1", title: "Wash Leo's jersey", done: false, due: today }],
    events: [
      { id: "e1", title: "Soccer Game", start: `${today}T10:00:00`, end: `${today}T11:00:00`, location: "Riverside Field", memberIds: ["m3"] },
    ],
  };
  const api = {
    members,
    get groceries() { return state.groceries; },
    get tasks() { return state.tasks; },
    get events() { return state.events; },
    addGrocery: async (item) => { state.groceries = [...state.groceries, { ...item, id: "new", checked: false, name: item.name.charAt(0).toUpperCase() + item.name.slice(1) }]; },
    removeGrocery: async (id) => { state.groceries = state.groceries.filter((g) => g.id !== id); },
    toggleGrocery: async (id) => { state.groceries = state.groceries.map((g) => g.id === id ? { ...g, checked: !g.checked } : g); },
    addTask: async (task) => { state.tasks = [...state.tasks, { ...task, id: "nt", done: false }]; },
    toggleTask: async (id) => { state.tasks = state.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t); },
    addEvent: async (event) => { state.events = [...state.events, { ...event, id: "ne" }]; },
    updateEvent: async (id, patch) => { state.events = state.events.map((e) => e.id === id ? { ...e, ...patch } : e); },
    removeEvent: async (id) => { state.events = state.events.filter((e) => e.id !== id); },
    currentUserId: "m1",
  };
  return { state, api };
}

describe("Fam AI guardrails", () => {
  it("classifies medical requests as red", () => {
    expect(classifyRequest("should i take my child to the doctor for a fever?").level).toBe("red");
  });
  it("classifies general knowledge as out of scope", () => {
    expect(isGeneralKnowledge("who won the super bowl in 2012?")).toBe(true);
  });
  it("does not flag household questions as general knowledge", () => {
    expect(isGeneralKnowledge("who's driving leo tonight?")).toBe(false);
    expect(isGeneralKnowledge("what time is soccer practice?")).toBe(false);
  });
});

describe("Fam AI deterministic routing", () => {
  it("routes grocery adds to ADD_LIST_ITEM", () => {
    const route = routeIntent("add milk to groceries", { members, groceries: [] });
    expect(route?.intent).toBe("ADD_LIST_ITEM");
    expect(route?.entities?.items?.map((item) => item.name)).toContain("milk");
  });
  it("routes reminders to CREATE_TASK", () => {
    const route = routeIntent("remind me to wash leo's jersey tomorrow", { members, tasks: [] });
    expect(route?.intent).toBe("CREATE_TASK");
    expect(route?.entities?.title).toContain("jersey");
  });
  it("routes schedule queries to GET_SCHEDULE", () => {
    const route = routeIntent("what's on today", { members, events: [] });
    expect(route?.intent).toBe("GET_SCHEDULE");
  });
  it("routes driver queries to GET_DRIVER", () => {
    const route = routeIntent("who's driving leo tonight", { members });
    expect(route?.intent).toBe("GET_DRIVER");
  });
});

describe("Fam AI orchestration", () => {
  it("executes low-risk grocery adds directly", async () => {
    const { state, api } = makeFixture();
    const result = await handleAskFam("add eggs and cheese", { state, api });
    expect(result.kind).toBe("execute");
    expect(result.canUndo).toBe(true);
    expect(state.groceries.some((g) => g.name === "Eggs")).toBe(true);
  });
  it("answers schedule queries without an LLM", async () => {
    const { state, api } = makeFixture();
    const result = await handleAskFam("what's on today", { state, api });
    expect(result.kind).toBe("answer");
    expect(result.text).toContain("Soccer Game");
  });
  it("previews shared events for confirmation", async () => {
    const { state, api } = makeFixture();
    const result = await handleAskFam("add leo's soccer game saturday at 10", { state, api });
    expect(result.kind).toBe("preview");
    expect(result.intent).toBe("CREATE_EVENT");
  });
  it("refuses out-of-scope general knowledge", async () => {
    const { state, api } = makeFixture();
    const result = await handleAskFam("who won the super bowl in 2012", { state, api });
    expect(result.kind).toBe("refused");
    expect(result.level).toBe("out_of_scope");
  });
  it("refuses medical advice", async () => {
    const { state, api } = makeFixture();
    const result = await handleAskFam("is my child sick with a fever and should i take them to the doctor", { state, api });
    expect(result.kind).toBe("refused");
    expect(result.level).toBe("red");
  });
  it("returns needsAi for open-ended planning", async () => {
    const { state, api } = makeFixture();
    const result = await handleAskFam("help us plan saturday", { state, api });
    expect(["needsAi", "answer", "preview"]).toContain(result.kind);
  });
});

describe("Fam AI suggestions", () => {
  it("generates prompts from state", () => {
    const prompts = getSuggestedPrompts(makeFixture().state, "today");
    expect(prompts.length).toBeGreaterThan(0);
  });
  it("generates action chips from open items", () => {
    const actions = getSuggestedActions(makeFixture().state);
    expect(actions.some((a) => a.kind === "tasks")).toBe(true);
  });
});
