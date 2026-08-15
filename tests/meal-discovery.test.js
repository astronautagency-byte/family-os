import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mealsSource = readFileSync(new URL("../src/pages/Meals.jsx", import.meta.url), "utf8");
const todaySource = readFileSync(new URL("../src/pages/Today.jsx", import.meta.url), "utf8");
const recipeSearchSource = readFileSync(new URL("../src/lib/recipeSearch.js", import.meta.url), "utf8");

test("meal roulette and Cook Mode use the Spoonacular edge function only", () => {
  assert.doesNotMatch(mealsSource, /themealdb|TheMealDB/i);
  assert.match(mealsSource, /functions\.invoke\("recipe-search"/);
});

test("meal ideas include the selected meal type and remain cacheable", () => {
  assert.match(mealsSource, /mealType:\s*slot/);
  assert.match(mealsSource, /offset:\s*0/);
  assert.match(mealsSource, /searchRecipes\(/);
  assert.match(recipeSearchSource, /FRESH_FOR_MS/);
  assert.match(recipeSearchSource, /pending\.has\(key\)/);
});

test("meal ideas shuffle in place without another provider request", () => {
  assert.match(mealsSource, /Shuffle ideas/);
  assert.match(mealsSource, /recipes:\s*\[\.\.\.current\.recipes\.slice\(1\), current\.recipes\[0\]\]/);
  assert.doesNotMatch(mealsSource, /Search recipes by ingredient|recipeSearchQuery/);
});

test("cuisine chips immediately rerun the active roulette with an explicit filter", () => {
  assert.match(mealsSource, /rouletteForSlot\(rouletteOptions\.date, rouletteOptions\.slot, rouletteOptions\.kitchenOnly, cuisine\)/);
  assert.match(mealsSource, /cuisine:\s*chosenCuisine === "American Comfort"/);
  assert.match(mealsSource, /query:\s*chosenCuisine \? `\$\{chosenCuisine\} \$\{slot\}` : slot/);
});

test("meal suggestions avoid quota-amplifying broad retries and preserve useful fallbacks", () => {
  assert.match(mealsSource, /searchRecipes\(/);
  assert.doesNotMatch(mealsSource, /broadData/);
  assert.match(mealsSource, /savedFallback/);
  assert.match(recipeSearchSource, /providerLimited:\s*true/);
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
