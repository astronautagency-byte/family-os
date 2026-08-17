import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { categorizeGroceryItem } from "../src/lib/groceryCategories.js";

const groceriesPage = readFileSync(new URL("../src/pages/Groceries.jsx", import.meta.url), "utf8");

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

test("grocery editors use a compact auto-suggesting category dropdown", () => {
  assert.match(groceriesPage, /function GroceryCategorySelect/);
  assert.match(groceriesPage, /Suggested from item name/);
  assert.match(groceriesPage, /aria-label="Grocery category"/);
  assert.equal((groceriesPage.match(/<GroceryCategorySelect/g) || []).length, 3);
  assert.match(groceriesPage, /categoryManual \? current\.category : categoryFromItemName\(name, "Other"\)/);
});
