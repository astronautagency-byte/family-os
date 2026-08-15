import { test } from "node:test";
import assert from "node:assert/strict";
import { categorizeGroceryItem } from "../src/lib/groceryCategories.js";

test("meal-plan ingredients receive useful grocery categories", () => {
  assert.equal(categorizeGroceryItem("Bacon"), "Meat & Seafood");
  assert.equal(categorizeGroceryItem("Blueberries"), "Produce");
  assert.equal(categorizeGroceryItem("Mild Cheddar Cheese"), "Dairy & Eggs");
  assert.equal(categorizeGroceryItem("Eggs"), "Dairy & Eggs");
});

test("inferred categories repair Other but preserve explicit user choices", () => {
  assert.equal(categorizeGroceryItem("Blueberries", "Other"), "Produce");
  assert.equal(categorizeGroceryItem("Blueberries", "Frozen"), "Frozen");
  assert.equal(categorizeGroceryItem("Mystery family item", "Other"), "Other");
});
