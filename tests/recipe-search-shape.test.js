import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(here, "..", "supabase", "functions", "recipe-search", "index.ts");
const source = readFileSync(sourcePath, "utf8");

test("recipe-search uses /v3/recipe (the current API Ninjas version)", () => {
  assert.match(source, /https:\/\/api\.api-ninjas\.com\/v3\/recipe/, "endpoint must be /v3/recipe as documented at https://api-ninjas.com/api/recipe");
  assert.doesNotMatch(source, /v1\/recipe/, "must not silently regress to the deprecated /v1/recipe path that returns 404 today");
});

test("cleanIngredients accepts API Ninjas' {name, quantity, unit}[] array shape", () => {
  assert.ok(source.includes("if (Array.isArray(raw))"), "must immediately branch on array input as documented");
  assert.ok(source.includes("entry.name || entry.ingredient || \"\""), "must extract ingredient name from each array entry");
  assert.ok(source.includes("Number.isFinite(quantityRaw)"), "must safely coerce quantity to a finite Number");
  assert.ok(source.includes("entry.unit || \"\""), "must pull unit from each array entry");
});

test("cleanIngredients retains a string-blob fallback path for older cached payloads", () => {
  assert.ok(source.includes('typeof raw === "string"'), "must still accept a legacy string-blob form (older caches, scrape fallbacks)");
  assert.ok(source.includes(".map((line) => ({ name: line,"), "string-blob fallback must reshape each line to { name: line, quantity: null, unit: '' }");
});

test("cleanInstructions accepts API Ninjas' string[] array shape", () => {
  assert.match(source, /cleanInstructions[^{]*\{\s*if \(Array\.isArray\(raw\)/, "must immediately branch on array input as documented");
  assert.match(source, /\.filter\(\(step\) => step\.length > 4\)/, "must drop short / blank steps");
  assert.match(source, /\.slice\(0, 12\)/, "must cap at 12 steps to keep cook mode scannable");
});

test("parseServings extracts a Number from a yield description string", () => {
  assert.ok(source.includes("parseServings = (raw) =>"), "must define parseServings(raw)");
  assert.ok(source.includes("text.match(/(\\d+)/)"), "must extract the leading integer with a (/\\d+/) regex from '6 servings' / '10 portions'");
  assert.ok(source.includes("n <= 0 || n > 50"), "must guard against negative / 99+ servings (sanity check on parsed yields)");
});

test("parseReadyInMinutes extracts approximate time from instruction text", () => {
  assert.ok(source.includes("parseReadyInMinutes = (instructions) =>"), "must define parseReadyInMinutes(instructions)");
  assert.ok(source.includes("hours?|hrs?"), "must recognise hour units (1 hour / 2 hrs) via hours? | hrs? in a regex literal");
  assert.ok(source.includes("min|minute"), "must recognise minute units (30 min / 45 minutes) via min | minute in a regex literal");
  assert.ok(source.includes("half an hour"), "must recognise 'half an hour' and snap to 30");
  assert.ok(source.includes("return null"), "must return null (not a fabricated number) when no time phrase is found");
});

test("normaliseRecipe never fabricates fields API Ninjas does not return", () => {
  // Per https://api-ninjas.com/api/recipe, the response only contains
  // title, ingredients, servings, instructions, optional nutrition.
  // cuisine and total_time / totalTime / readyInMinutes are NOT returned.
  assert.doesNotMatch(source, /payload\.cuisine/, "must not pull 'cuisine' that API Ninjas does not return");
  assert.doesNotMatch(source, /payload\.total_time/, "must not pull 'total_time' that API Ninjas does not return");
  assert.doesNotMatch(source, /payload\.totalTime/, "must not pull 'totalTime' that API Ninjas does not return");
  assert.match(source, /readyInMinutes:\s*parseReadyInMinutes\(instructions\)/, "readyInMinutes must be derived from the instruction text, not invented");
});

test("default result limit is 1 (the free-tier ceiling per API Ninjas docs)", () => {
  assert.match(source, /DEFAULT_RESULT_LIMIT\s*=\s*1/, "free tier returns one recipe by default per docs");
});

test("title parameter is sent (used to be 'query' — current endpoint accepts 'title' as the free-text search)", () => {
  assert.match(source, /params\.set\("title"/, "must set the documented 'title' query parameter");
  assert.doesNotMatch(source, /params\.set\("query"/, "must not regress to a hypothetical 'query' parameter");
  assert.match(source, /params\.set\("limit"/, "must respect API Ninjas' documented 'limit' parameter");
});

test("request method is GET (current API Ninjas endpoint is GET, not POST)", () => {
  assert.match(source, /method:\s*"GET"/, "endpoint docs specify GET");
});
