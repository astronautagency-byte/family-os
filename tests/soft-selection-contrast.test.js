import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const chat = readFileSync(new URL("../src/pages/Chat.jsx", import.meta.url), "utf8");

test("soft calendar selections use dark ink instead of white text", () => {
  assert.match(css, /calendar-sources-primary \.calendar-sources-tab\.selected\{[^}]*color:var\(--color-ink\)/);
  const filledSelector = css.match(/\.app-shell :where\(([^)]*)\)\{color:var\(--color-on-accent\)!important\}/)?.[1] || "";
  assert.doesNotMatch(filledSelector, /calendar-sources-tab\.selected/);
});

test("chat audience selection uses the accessible chat soft\/strong pair", () => {
  assert.match(chat, /backgroundColor: activeThread === "household" \? "var\(--color-chat-soft\)"/);
  assert.match(chat, /color: activeThread === "household" \? "var\(--color-chat-strong\)"/);
});
