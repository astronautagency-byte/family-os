import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("application page headers use an uncoloured editorial treatment", () => {
  assert.match(css, /\.theme-dark \.app-shell \.page-header\{[\s\S]*?background:transparent!important/);
  assert.match(css, /\.app-shell \.page-header:before\{display:none\}/);
});

test("application page titles retain large responsive typography", () => {
  assert.match(css, /font-size:clamp\(30px,3vw,38px\)/);
  assert.match(css, /font-size:clamp\(27px,8vw,32px\)!important/);
});
