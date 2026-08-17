import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("application page headers use an uncoloured editorial treatment", () => {
  assert.match(css, /\.theme-dark \.app-shell \.page-header\{[\s\S]*?background:transparent!important/);
  assert.match(css, /\.app-shell \.page-header:before\{display:none\}/);
});

test("application page titles use the reduced responsive scale", () => {
  assert.match(css, /60% of the former 38px\/32px scale/);
  assert.match(css, /body \.app-content \.page-title\{\s*font-size:23px!important/);
  assert.match(css, /body \.app-content \.page-title\{font-size:19px!important/);
});
