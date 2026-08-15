import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const meals = readFileSync(resolve(root, "src/pages/Meals.jsx"), "utf8");
const css = readFileSync(resolve(root, "src/index.css"), "utf8");

test("Surprise me is promoted to a filled primary meal action", () => {
  assert.match(meals, /meal-slot-tool meal-surprise-action/);
  assert.match(css, /\.meal-surprise-action\{[^}]*background:var\(--color-accent\)!important/);
  assert.match(css, /@media\(max-width:600px\)[^{]*\{[^}]*\.meal-surprise-action\{[^}]*flex:1 0 100%/);
});
