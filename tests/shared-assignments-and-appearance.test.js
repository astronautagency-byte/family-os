import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("task lists can be safely deleted without deleting their tasks", async () => {
  const context = await read("src/context/FamilyContext.jsx");
  const tasks = await read("src/pages/Tasks.jsx");
  assert.match(context, /const removeTaskList = async/);
  assert.match(context, /task\.listId === id \? \{ \.\.\.task, listId: null \}/);
  assert.match(tasks, /Delete .*this list/);
});

test("tasks and groceries persist multi-person assignments", async () => {
  const migration = await read("supabase/migrations/202608160012_multi_assignments_and_task_list_deletion.sql");
  const context = await read("src/context/FamilyContext.jsx");
  const tasks = await read("src/pages/Tasks.jsx");
  const groceries = await read("src/pages/Groceries.jsx");
  assert.match(migration, /tasks add column if not exists assignee_ids uuid\[\]/i);
  assert.match(migration, /grocery_items add column if not exists assignee_ids uuid\[\]/i);
  assert.match(context, /dbPatch\.assignee_ids/);
  assert.match(tasks, /Choose one or more/);
  assert.match(groceries, /For family members/);
});

test("appearance dropdown renders the real palette for every option", async () => {
  const settings = await read("src/pages/Settings.jsx");
  const palettes = await read("src/data/appColorSchemes.js");
  assert.match(settings, /settings-color-options/);
  assert.match(settings, /scheme\.colors\.map/);
  assert.match(palettes, /FamOS Pop/);
  assert.match(palettes, /Electric coast/);
});

test("billing portal creates and persists a Chargebee customer when needed", async () => {
  const portal = await read("supabase/functions/chargebee-portal/index.ts");
  assert.match(portal, /chargebeeRequest\("\/customers"/);
  assert.match(portal, /chargebee_customer_id: customerId/);
  assert.match(portal, /\/portal_sessions/);
});
