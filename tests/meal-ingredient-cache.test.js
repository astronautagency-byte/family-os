import assert from "node:assert/strict";
import test from "node:test";
import { canonicalIngredientName, isIngredientOnList } from "../src/lib/mealIngredientCache.js";

test("canonicalIngredientName removes recipe quantities, measures and preparation", () => {
  const examples = new Map([
    ["1/2 lb beef", "beef"],
    ["pinch salt", "salt"],
    ["2 tsp sesame seed oil", "sesame seed oil"],
    ["1 cup mushrooms", "mushrooms"],
    ["1 tsp minced garlic", "garlic"],
    ["½ cup sliced onion", "onion"],
  ]);
  for (const [input, expected] of examples) assert.equal(canonicalIngredientName(input), expected);
});

test("ingredient coverage compares the item rather than its recipe amount", () => {
  const groceries = [{ name: "Mushrooms" }, { name: "salt" }];
  assert.equal(isIngredientOnList("1 cup mushrooms", groceries), true);
  assert.equal(isIngredientOnList("pinch salt", groceries), true);
  assert.equal(isIngredientOnList("2 tsp sesame seed oil", groceries), false);
});
