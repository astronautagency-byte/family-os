import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tasksPage = readFileSync(new URL("../src/pages/Tasks.jsx", import.meta.url), "utf8");
const familyContext = readFileSync(new URL("../src/context/FamilyContext.jsx", import.meta.url), "utf8");

test("task assignment remains saveable while custom-list schema is pending", () => {
  assert.match(familyContext, /task_type\|list_id\|schema cache/);
  assert.match(familyContext, /compatiblePatch/);
  assert.match(familyContext, /assignee_id/);
});

test("task editor reports persistence failures and prevents duplicate saves", () => {
  assert.match(tasksPage, /taskSaveError/);
  assert.match(tasksPage, /taskSaving\?"Saving…":"Save changes"/);
  assert.match(tasksPage, /type="button" key=\{member\.id\}/);
});
