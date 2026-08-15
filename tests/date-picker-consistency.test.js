import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (file) => readFileSync(resolve(process.cwd(), file), "utf8");

test("user-facing dates use the shared FamOS DateField", () => {
  const groceries = read("src/pages/Groceries.jsx");
  const auth = read("src/pages/Auth.jsx");
  assert.match(groceries, /<DateField compact label="Use by"/);
  assert.match(auth, /<DateField label="Date of birth \(optional\)"/);
  assert.doesNotMatch(`${groceries}\n${auth}`, /type=["']date["']/);
});

test("compact date fields retain the shared calendar with inventory sizing", () => {
  const ui = read("src/components/ui.jsx");
  const css = read("src/index.css");
  assert.match(ui, /date-field-compact/);
  assert.match(css, /\.date-field-compact \.date-popover\{right:0;left:auto\}/);
});
