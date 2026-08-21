import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const familyContext = readFileSync(new URL("../src/context/FamilyContext.jsx", import.meta.url), "utf8");
const groceries = readFileSync(new URL("../src/pages/Groceries.jsx", import.meta.url), "utf8");
const tasks = readFileSync(new URL("../src/pages/Tasks.jsx", import.meta.url), "utf8");
const meals = readFileSync(new URL("../src/components/MealSuggestions.jsx", import.meta.url), "utf8");
const kitchen = readFileSync(new URL("../src/pages/KitchenWatch.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("task notes and selected custom lists persist server-side", () => {
  assert.match(familyContext, /notes: task\.notes \|\| ""/);
  assert.match(familyContext, /list_id: task\.listId \|\| null/);
  assert.match(tasks, /Notes \(optional\)/);
});

test("shopping lists scope new items and destructive actions", () => {
  assert.match(familyContext, /grocery_lists/);
  assert.match(groceries, /activeGroceryListId === "all" \? null : activeGroceryListId/);
  assert.match(groceries, /clearGroceries\(activeGroceryListId/);
  assert.match(groceries, /clearCheckedGroceries\(activeGroceryListId/);
  assert.match(familyContext, /const removeGroceryList = async/);
  assert.match(groceries, /Delete list/);
});

test("mobile chat composer clears the bottom navigation", () => {
  const chat = readFileSync(new URL("../src/pages/Chat.jsx", import.meta.url), "utf8");
  assert.match(chat, /chat-mobile-composer/);
  assert.match(css, /chat-mobile-composer\{padding-bottom:calc\(10px \+ env\(safe-area-inset-bottom\)\)/);
});

test("settings restores the Astronaut Digital credit", () => {
  const settings = readFileSync(new URL("../src/pages/Settings.jsx", import.meta.url), "utf8");
  assert.match(settings, /https:\/\/getastronaut\.io/);
  assert.match(settings, /Astronaut Digital/);
});

test("Kitchen Watch renders an expiry progress meter", () => {
  assert.match(kitchen, /inventoryExpiryProgress/);
  assert.match(kitchen, /<CircularProgress value=\{expired \? 100 : progress\.percent\}/);
  assert.match(kitchen, /days until expiry/);
  assert.match(kitchen, /color-mix\(in srgb,var\(--color-shopping\)/);
  assert.match(css, /\.ui-circular-progress/);
});

test("mobile meal cuisine choices stay inside the viewport", () => {
  assert.doesNotMatch(meals, /ROLETTE_QUERIES/);
  assert.match(css, /\.meal-roulette-cuisine-chips\{flex-wrap:nowrap;max-width:100%/);
});
