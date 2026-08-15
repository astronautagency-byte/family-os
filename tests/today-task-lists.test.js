import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const today = readFileSync(new URL("../src/pages/Today.jsx", import.meta.url), "utf8");

test("Today surfaces custom task lists even when nothing is due today", () => {
  assert.match(today, /taskLists = \[\]/);
  assert.match(today, /const taskListSummaries = taskLists\.map/);
  assert.match(today, /Tasks & lists/);
  assert.match(today, /homeTasks = todaysTasks\.length/);
});
