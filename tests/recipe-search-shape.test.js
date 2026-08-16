import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "..", "supabase", "functions", "recipe-search", "index.ts"), "utf8");

test("recipe-search uses Spoonacular complexSearch server-side", () => {
  assert.match(source, /https:\/\/api\.spoonacular\.com\/recipes\/complexSearch/);
  assert.match(source, /Deno\.env\.get\("SPOONACULAR_API_KEY"\)/);
  assert.match(source, /"x-api-key": apiKey/);
  assert.doesNotMatch(source, /api-ninjas/i);
});

test("Spoonacular search requests complete recipe information", () => {
  for (const parameter of ["query", "includeIngredients", "instructionsRequired", "addRecipeInformation", "addRecipeInstructions", "fillIngredients", "number", "offset"]) {
    assert.ok(source.includes(`params.set("${parameter}"`), `missing Spoonacular parameter ${parameter}`);
  }
  assert.match(source, /DEFAULT_RESULT_LIMIT\s*=\s*12/);
  assert.match(source, /MAX_RESULT_LIMIT\s*=\s*24/);
  assert.match(source, /totalResults/);
  assert.match(source, /safeOffset.*900/);
});

test("Spoonacular discovery is lightweight and defers full details until a recipe is selected", () => {
  assert.match(source, /params\.set\("addRecipeInformation", details \? "true" : "false"\)/);
  assert.match(source, /params\.set\("addRecipeInstructions", details \? "true" : "false"\)/);
  assert.match(source, /params\.set\("fillIngredients", details \|\| Boolean\(cleanIngredientList\) \? "true" : "false"\)/);
});

test("Spoonacular search supports an explicit cuisine filter", () => {
  assert.match(source, /params\.set\("cuisine", cleanText\(cuisine, 60\)\)/);
});

test("Spoonacular dietary restrictions map to diets, intolerances and exclusions", () => {
  assert.match(source, /DIET_MAP/);
  assert.match(source, /INTOLERANCE_MAP/);
  assert.ok(source.includes('params.set("diet"'));
  assert.ok(source.includes('params.set("intolerances"'));
  assert.ok(source.includes('params.set("excludeIngredients"'));
});

test("Spoonacular results normalize to the existing FamOS recipe contract", () => {
  for (const field of ["extendedIngredients", "analyzedInstructions", "readyInMinutes", "servings", "cuisines", "image", "sourceUrl"]) {
    assert.ok(source.includes(field), `normalizer must consume ${field}`);
  }
  assert.match(source, /Array\.isArray\(raw\?\.results\)/);
  assert.match(source, /source: "spoonacular"/);
});

test("Kitchen Watch recipe searches expose used and missing ingredient intelligence", () => {
  assert.match(source, /max-used-ingredients/);
  assert.match(source, /ignorePantry/);
  assert.match(source, /usedIngredientCount/);
  assert.match(source, /missedIngredientCount/);
});

test("packaged-food UPC lookup uses Spoonacular server-side", () => {
  const productSource = readFileSync(resolve(here, "..", "supabase", "functions", "food-product-lookup", "index.ts"), "utf8");
  assert.match(productSource, /food\/products\/upc/);
  assert.match(productSource, /Deno\.env\.get\("SPOONACULAR_API_KEY"\)/);
  assert.match(productSource, /"x-api-key": apiKey/);
});

test("recipe-search handles Spoonacular quota responses without leaking the key", () => {
  assert.match(source, /response\.status === 402 \|\| response\.status === 429/);
  assert.match(source, /Spoonacular quota reached/);
  assert.doesNotMatch(source, /apiKey.*JSON\.stringify/);
});
