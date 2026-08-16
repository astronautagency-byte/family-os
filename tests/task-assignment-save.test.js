import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tasksPage = readFileSync(new URL("../src/pages/Tasks.jsx", import.meta.url), "utf8");
const familyContext = readFileSync(new URL("../src/context/FamilyContext.jsx", import.meta.url), "utf8");

test("custom task-list selection is never silently discarded", () => {
  assert.match(familyContext, /task_type\|notes\|schema cache/);
  assert.match(familyContext, /&& !task\.listId/);
  assert.match(familyContext, /&& patch\.listId === undefined/);
  assert.match(familyContext, /compatiblePatch/);
  assert.match(familyContext, /notes: task\.notes/);
  assert.match(familyContext, /assignee_id/);
});

test("task editor reports persistence failures and prevents duplicate saves", () => {
  assert.match(tasksPage, /taskSaveError/);
  assert.match(tasksPage, /taskSaving\?"Saving…":"Save changes"/);
  assert.match(tasksPage, /type="button" key=\{member\.id\}/);
});
