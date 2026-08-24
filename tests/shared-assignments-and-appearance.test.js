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

test("appearance picker renders the real palette for every option", async () => {
  const settings = await read("src/pages/Settings.jsx");
  const picker = await read("src/components/ColorSchemePicker.jsx");
  const palettes = await read("src/data/appColorSchemes.js");
  assert.match(settings, /<ColorSchemePicker/);
  assert.match(picker, /scheme\.colors\.map/);
  assert.match(palettes, /FamOS Pop/);
  assert.match(palettes, /Electric Coast/);
});

test("Stripe billing portal is owner-scoped and server-side", async () => {
  const portal = await read("supabase/functions/billing-portal/index.ts");
  assert.match(portal, /stripe\.billingPortal\.sessions\.create/);
  assert.match(portal, /stripe_customer_id/);
  assert.match(portal, /Only the household owner can manage billing/);
});
