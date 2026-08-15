import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const meals = fs.readFileSync(new URL("../src/pages/Meals.jsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("meal creator profile sits in metadata below the meal title", () => {
  const titleIndex = meals.indexOf('className={`meal-slot-value');
  const metaIndex = meals.indexOf('className="meal-slot-meta"');
  assert.ok(titleIndex >= 0 && metaIndex > titleIndex);
  assert.match(meals, /Added by \{adder\.name\}/);
  assert.match(css, /\.meal-slot-meta\{display:flex/);
});
