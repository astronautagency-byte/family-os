import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

test("FamAI desktop sheet is contained by both viewport edges", () => {
  assert.match(css, /\.app-shell \.fam-ai-sheet\{inset:6vh max\(16px,calc\(\(100vw - 1040px\)\/2\)\);width:auto/);
  assert.match(css, /max-height:88vh;transform:none/);
});

test("FamAI desktop entrance animation does not translate horizontally", () => {
  const animation = css.match(/@keyframes fam-ai-sheet-in-contained\{([^}]+\}[^}]+)\}/)?.[1] || "";
  assert.doesNotMatch(animation, /translateX|translate\(-50%/);
  assert.match(animation, /translateY/);
});
