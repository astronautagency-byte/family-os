import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, "..", "src", "index.css");
const css = readFileSync(cssPath, "utf8");

// Match top-level `.selector { ... }` blocks. The leading `(?:^|})\s*` guard
// strips out rules whose leftmost segment is some OTHER selector (e.g.
// `.foo .nav-icon`) — we only want top-level rules where `.nav-icon` IS the
// root selector so specificity is preserved. Whitespace between selector
// and `{` is tolerated so a re-minified future pass that drops the space
// still hits the test. `selector` is the unescaped selector name, e.g.
// ".nav-icon" — the helper takes care of escaping the dot.
function selectorRules(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|})\\s*${escaped}\\s*\\{([^}]*)\\}`, "g");
  return [...source.matchAll(re)].map((m) => m[1].trim());
}

const navIconRules = selectorRules(css, ".nav-icon");
const broadcastComposeIconRules = selectorRules(css, ".broadcast-compose-icon");

test(".nav-icon rules that size the tile include position:relative (the badge anchor)", () => {
  // At least three .nav-icon rules (mobile + tablet sidebar + tablet-mode media query).
  assert.ok(navIconRules.length >= 3, `expected at least 3 top-level .nav-icon rules, got ${navIconRules.length}`);
  // Any .nav-icon rule that sizes the icon (sets width/height) MUST also be
  // the position-relative anchor — a transition-only override (no width/height)
  // isn't an icon tile and is allowed to omit position:relative.
  const sizingRules = navIconRules.filter((rule) => /\b(?:width|height)\s*:/.test(rule));
  assert.ok(sizingRules.length >= 3, `expected at least 3 positioning .nav-icon rules, got ${sizingRules.length}`);
  for (const rule of sizingRules) {
    assert.ok(
      /position\s*:\s*relative/.test(rule),
      `.nav-icon rule missing position:relative (badge would anchor to the wrong element): ${rule.slice(0, 60)}…`,
    );
  }
});

test(".nav-icon transition is explicit (no transition:all which would animate badge mutations)", () => {
  for (const rule of navIconRules) {
    assert.ok(
      !/transition\s*:\s*all\b/.test(rule),
      `.nav-icon rule still uses transition:all — replace with explicit properties so badge text swaps don't paint-animate: ${rule.slice(0, 80)}…`,
    );
  }
});

test(".broadcast-compose-icon transition is a SINGLE declaration (no Tailwind parse break)", () => {
  assert.ok(broadcastComposeIconRules.length >= 1, "expected at least one .broadcast-compose-icon rule");
  for (const rule of broadcastComposeIconRules) {
    // Earlier regression: `transition:background var(--motion-base) ease;color var(...)`
    // parses as two declarations, the second being an invalid `color var(--motion-base) ease`.
    // Valid shape: single declaration with comma-separated entries between background and color.
    assert.ok(
      /transition\s*:\s*background[^,}]+,\s*color/.test(rule),
      `.broadcast-compose-icon transition is not a single comma-separated declaration: ${rule.slice(0, 120)}…`,
    );
    assert.ok(
      !/}\s*\.broadcast-compose-icon\s*\{[^}]*color\s+var\(--motion/.test("X" + rule + "X"),
      `Suspicious pattern matched: standalone color var(...) declaration after rule end`,
    );
  }
});

test(".nav-badge halo color is darker than the nav strip background (must have visibility)", () => {
  const navBadgeRule = css.match(/\.nav-badge\{[^}]+\}/);
  assert.ok(navBadgeRule, ".nav-badge rule not found");
  const haloMatch = navBadgeRule[0].match(/box-shadow\s*:\s*0\s+0\s+0\s+2px\s+(var\([^)]+\)|[^;}\s]+)/);
  assert.ok(haloMatch, "could not parse .nav-badge halo color");
  const haloToken = haloMatch[1];
  assert.notEqual(haloToken, "var(--color-surface)", "halo color was --color-surface (it blends with the nav strip)");
  assert.notEqual(haloToken, "var(--color-canvas)", "halo color was --color-canvas (coin flip on theme)");
  assert.ok(
    /var\(--color-/.test(haloToken),
    `halo must be a branded design token, got "${haloToken}"`,
  );
});
