import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const context = readFileSync(new URL("../src/context/FamilyContext.jsx", import.meta.url), "utf8");
const groceries = readFileSync(new URL("../src/pages/Groceries.jsx", import.meta.url), "utf8");

test("optimistic grocery inserts share their final UUID with realtime", () => {
  assert.match(context, /crypto\.randomUUID/);
  assert.match(context, /id: tempId/);
  assert.match(context, /findIndex\(\(candidate\) => candidate\.id === item\.id\)/);
});

test("favourite quick-add and assignees are duplicate safe", () => {
  assert.match(groceries, /pendingStaplesRef/);
  assert.match(groceries, /pendingStaplesRef\.current\.has/);
  assert.match(groceries, /new Set\(item\.assigneeIds/);
  assert.match(context, /const uniqueIds/);
  assert.match(context, /assignee_ids: assigneeIds/);
});
