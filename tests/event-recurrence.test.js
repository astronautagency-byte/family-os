import test from "node:test";
import assert from "node:assert/strict";
import { expandRecurringEvents } from "../src/lib/eventRecurrence.js";

test("expands a weekly event inside the requested range", () => {
  const events = [{ id: "school", title: "School pickup", start: "2026-08-03T19:00:00.000Z", end: "2026-08-03T20:00:00.000Z", recurrence: "weekly" }];
  const result = expandRecurringEvents(events, "2026-08-01T00:00:00.000Z", "2026-08-31T23:59:59.000Z");
  assert.equal(result.length, 5);
  assert.deepEqual(result.map((event) => event.start.slice(0, 10)), ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"]);
  assert.ok(result.every((event) => event.seriesId === "school"));
});

test("honours the recurrence end date", () => {
  const events = [{ id: "bins", start: "2026-08-01T12:00:00.000Z", end: "2026-08-01T12:30:00.000Z", recurrence: "daily", recurrenceUntil: "2026-08-03" }];
  const result = expandRecurringEvents(events, "2026-08-01T00:00:00.000Z", "2026-08-20T23:59:59.000Z");
  assert.equal(result.length, 3);
});

test("leaves non-recurring events unchanged", () => {
  const event = { id: "one", start: "2026-08-05T12:00:00.000Z", end: "2026-08-05T13:00:00.000Z", recurrence: "none" };
  assert.deepEqual(expandRecurringEvents([event], "2026-08-01", "2026-08-31"), [event]);
});
