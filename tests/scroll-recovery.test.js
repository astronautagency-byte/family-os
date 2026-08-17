import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const lock = fs.readFileSync(new URL("../src/lib/bodyScrollLock.js", import.meta.url), "utf8");

test("pages recover from a stale dialog scroll lock", () => {
  assert.match(css, /body:not\(:has\(\.m3-dialog-layer,\.marketing-drawer\.is-open,\.cook-focus-screen\)\)\s*\{\s*overflow-y:auto!important/);
});

test("scroll locks survive module refreshes and release cleanly", () => {
  assert.match(lock, /window\[LOCK_STATE_KEY\]/);
  assert.match(lock, /delete document\.body\.dataset\.scrollLocked/);
  assert.doesNotMatch(lock, /document\.body\.style\.overflow = "hidden"/);
});
