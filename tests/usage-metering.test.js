import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("usage is incremented atomically and cannot exceed the monthly allowance", async () => {
  const sql = await read("supabase/migrations/202608160011_household_api_usage.sql");
  assert.match(sql, /used_count\s*<\s*allowance/i);
  assert.match(sql, /date_trunc\('month'/i);
  assert.match(sql, /revoke all on function public\.consume_household_api_usage/i);
  assert.match(sql, /grant execute on function public\.consume_household_api_usage[\s\S]*service_role/i);
});

test("paid API functions enforce the shared household meter", async () => {
  for (const name of ["fam-ai", "recipe-search", "recipe-nutrition", "meal-suggestions", "analyze-receipt"]) {
    const source = await read(`supabase/functions/${name}/index.ts`);
    assert.match(source, /consumeUsage\(request,/i, `${name} should consume usage`);
    assert.match(source, /usageLimitResponse/i, `${name} should return a limit response`);
  }
});

test("settings displays remaining monthly usage", async () => {
  const settings = await read("src/pages/Settings.jsx");
  assert.match(settings, /functions\.invoke\("usage-status"\)/);
  assert.match(settings, /Monthly usage/);
  assert.match(settings, /remaining} left/);
});

test("allowance defaults mirror the Chargebee feature limits", async () => {
  const helper = await read("supabase/functions/_shared/usage.ts");
  assert.match(helper, /CHARGEBEE_FAMAI_QUERY_LIMIT".*, fallback: 100/);
  assert.match(helper, /CHARGEBEE_PREMIUM_OPERATION_LIMIT".*, fallback: 50/);
});
