import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/landing.css"), "utf8");

test("marketing surface aliases its core design roles to app tokens", () => {
  for (const declaration of [
    "--landing-color-primary:var(--color-accent)",
    "--landing-color-surface-dark:var(--color-ink)",
    "--landing-color-text-muted:var(--color-ink-soft)",
    "--landing-border:var(--color-border)",
  ]) assert.ok(css.includes(declaration), `missing ${declaration}`);
});

test("marketing controls and cards use the app component geometry", () => {
  assert.match(css, /min-height:44px;\s*border-radius:var\(--radius-control\)!important/);
  assert.match(css, /border-radius:var\(--radius-card\)!important/);
  assert.match(css, /outline:3px solid color-mix\(in srgb,var\(--color-accent\) 38%,transparent\)!important/);
});

test("marketing feature colours use semantic app pairs", () => {
  for (const token of ["calendar", "meals", "shopping", "chat", "family"]) {
    assert.ok(css.includes(`var(--color-${token}-soft)`));
    assert.ok(css.includes(`var(--color-${token}-strong)`));
  }
});
