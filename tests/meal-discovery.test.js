import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mealsSource = readFileSync(new URL("../src/pages/Meals.jsx", import.meta.url), "utf8");
const todaySource = readFileSync(new URL("../src/pages/Today.jsx", import.meta.url), "utf8");

test("meal roulette and Cook Mode use the Spoonacular edge function only", () => {
  assert.doesNotMatch(mealsSource, /themealdb|TheMealDB/i);
  assert.match(mealsSource, /functions\.invoke\("recipe-search"/);
});

test("roulette requests include the selected meal type", () => {
  assert.match(mealsSource, /mealType:\s*slot/);
  assert.match(mealsSource, /offset:\s*Math\.floor\(Math\.random\(\) \* 12\)/);
});

test("roulette re-spins in place and the ingredient search field is removed", () => {
  assert.match(mealsSource, /onClick=\{\(\) => rouletteForSlot\(rouletteOptions\.date, rouletteOptions\.slot, rouletteOptions\.kitchenOnly, rouletteCuisine\)\}/);
  assert.doesNotMatch(mealsSource, /Search recipes by ingredient|recipeSearchQuery/);
});

test("cuisine chips immediately rerun the active roulette with an explicit filter", () => {
  assert.match(mealsSource, /rouletteForSlot\(rouletteOptions\.date, rouletteOptions\.slot, rouletteOptions\.kitchenOnly, cuisine\)/);
  assert.match(mealsSource, /cuisine:\s*chosenCuisine === "American Comfort"/);
  assert.match(mealsSource, /query:\s*chosenCuisine \? `\$\{chosenCuisine\} \$\{slot\}` : slot/);
});

test("cuisine suggestions preserve useful errors and broaden only after a valid empty result", () => {
  assert.match(mealsSource, /invokeEdgeFunction\("recipe-search"/);
  assert.match(mealsSource, /if \(!list\.length && chosenCuisine\)/);
  assert.match(mealsSource, /here are a few from any cuisine instead/);
  assert.match(mealsSource, /friendlyRecipeSearchError/);
  assert.doesNotMatch(mealsSource, /setRouletteError\(error\?\.message \|\| "Meal roulette/);
});

test("kitchen ideas use the reviewed kitchen inventory", () => {
  assert.match(mealsSource, /useKitchenInventory/);
  assert.match(mealsSource, /inventoryIngredientNames/);
  assert.match(mealsSource, /ingredients:\s*kitchenOnly \? kitchenIngredients\.join/);
  assert.match(mealsSource, /Cook from what you have/);
});

test("Today exposes all daily meal slots with direct ideas and Cook intents", () => {
  for (const slot of ["breakfast", "lunch", "dinner"]) assert.match(todaySource, new RegExp(`id: "${slot}"`));
  assert.match(todaySource, /famos:meal-ideas-intent:v1/);
  assert.match(todaySource, /famos:cook-intent:v1/);
  assert.match(mealsSource, /getItem\("famos:meal-ideas-intent:v1"\)/);
});

test("Today hides meal-planning actions once a meal is planned", () => {
  assert.match(todaySource, /meal \? \(\s*<button[^>]+className="cook"/);
  assert.match(todaySource, /className=\{`today-daily-meal-actions \$\{meal \? "is-single" : ""\}`\}/);
});
