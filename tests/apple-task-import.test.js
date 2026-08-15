import test from "node:test";
import assert from "node:assert/strict";
import { parseAppleTaskText } from "../src/utils/appleTaskImport.js";

test("Apple list import normalizes bullets and reminder checkboxes", () => {
  assert.deepEqual(parseAppleTaskText("Reminders\n• Pick up milk\n- Call school\n[x] Pack bags"), ["Pick up milk", "Call school", "Pack bags"]);
});

test("Apple list import removes duplicates and caps review size", () => {
  assert.deepEqual(parseAppleTaskText("1. Dentist\nDentist\n2) Library"), ["Dentist", "Library"]);
  assert.equal(parseAppleTaskText(Array.from({ length: 120 }, (_, i) => `Task ${i}`).join("\n")).length, 100);
});
