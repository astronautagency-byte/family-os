import { test } from "node:test";
import postcss from "postcss";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const tokensPath = resolve(root, "src", "theme", "famos-tokens.css");
const indexPath = resolve(root, "src", "index.css");
const tokens = readFileSync(tokensPath, "utf8");
const index = readFileSync(indexPath, "utf8");

// Strip /* … */ comments so the assertion regex doesn't accidentally pick up
// values from doc comments.
function stripCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

const tokensBare = stripCssComments(tokens);
const indexBare = stripCssComments(index);

test("src/theme/famos-tokens.css exists and is non-empty", () => {
  assert.ok(tokens.length > 1000, `tokens file too small (${tokens.length} bytes) — likely truncated`);
});

test("src/index.css cascade axiom: tokens file is imported AFTER tailwindcss and BEFORE component CSS", () => {
  // Find the line indices of the two imports and the start of the first
  // component CSS block (anything after the last @import is component CSS).
  const tailwindIdx = index.indexOf("@import \"tailwindcss\"");
  const tokensIdx = index.indexOf("./theme/famos-tokens.css");
  assert.ok(tailwindIdx > -1, "@import tailwindcss missing");
  assert.ok(tokensIdx > -1, "@import ./theme/famos-tokens.css missing from src/index.css");
  assert.ok(tokensIdx > tailwindIdx, "tokens import must come AFTER tailwindcss");
  // The first body / component CSS rule starts after the @imports — verify
  // the tokens file appears before the first html, body, or .form-field rule.
  const firstComponentIdx = index.indexOf("html, body, #root");
  assert.ok(firstComponentIdx > -1, "html, body, #root guard missing");
  assert.ok(tokensIdx < firstComponentIdx, "tokens import must come BEFORE component CSS");
});

test("src/theme/famos-tokens.css declares every original @theme token (no silent loss)", () => {
  const required = [
    "--font-sans", "--font-display",
    "--color-canvas", "--color-surface", "--color-surface-sunken",
    "--color-border", "--color-border-strong",
    "--color-ink", "--color-ink-soft", "--color-ink-faint",
    "--color-accent", "--color-accent-soft", "--color-accent-strong",
    "--sunrise-gradient",
    "--color-warn", "--color-warn-soft",
    "--color-good", "--color-good-soft",
    "--color-fam-coral", "--color-fam-marigold", "--color-fam-moss",
    "--color-fam-sky", "--color-fam-plum", "--color-fam-rose",
    "--pastel-pink", "--pastel-peach", "--pastel-yellow",
    "--pastel-mint", "--pastel-blue", "--pastel-lilac",
    "--text-xs", "--text-sm", "--text-body", "--text-section", "--text-page",
    "--radius-control", "--radius-card",
    "--motion-fast", "--motion-base",
  ];
  for (const name of required) {
    assert.ok(
      tokensBare.includes(name + ":"),
      `original token \`${name}\` not redeclared in src/theme/famos-tokens.css`,
    );
  }
});

test("src/theme/famos-tokens.css adds the deduplicated radius tokens", () => {
  const added = [
    { name: "--radius-pill", value: "9999px" },
    { name: "--radius-md", value: "6px" },
    { name: "--radius-sm", value: "4px" },
    { name: "--radius-section", value: "20px" },
    { name: "--radius-xs", value: "2px" },
    { name: "--radius-pill-sm", value: "8px" },
  ];
  for (const { name, value } of added) {
    assert.ok(
      tokensBare.includes(`${name}: ${value}`),
      `radius token \`${name}: ${value}\` not found in src/theme/famos-tokens.css`,
    );
  }
});

test("src/theme/famos-tokens.css adds --motion-normal (was previously dangling)", () => {
  assert.ok(
    /--motion-normal\s*:\s*200ms/.test(tokensBare),
    "--motion-normal must be declared (200ms is the natural midpoint between --motion-fast and --motion-base)",
  );
});

function relativeLuminance(hex) {
  const channels = hex.replace("#", "").match(/.{2}/g).map((value) => parseInt(value, 16) / 255);
  const [r, g, b] = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Resolve the shipped override cascade, including semantic aliases, rather than
// testing the superseded base palette in isolation.
function effectiveTheme(dark) {
  const values = {};
  const collect = (node) => node.walkDecls((d) => { values[d.prop] = d.value; });
  const base = postcss.parse(tokensBare);
  base.walkAtRules("theme", collect);
  if (dark) base.walkRules((r) => { if (r.selector === ".theme-dark") collect(r); });
  const contrast = postcss.parse(readFileSync(resolve(root, "src/theme/contrast.css"), "utf8"));
  contrast.walkRules((r) => {
    if (r.selector.startsWith(":root[data-famos-theme]") ||
        (dark && r.selector.startsWith(':root[data-famos-theme="dark"]'))) collect(r);
  });
  return values;
}
function tokenValue(values, name, seen = new Set()) {
  assert.ok(!seen.has(name), "Circular token alias: " + name);
  seen.add(name);
  const value = values[name];
  const alias = value?.match(/^var\((--[\w-]+)\)$/);
  return alias ? tokenValue(values, alias[1], seen) : value;
}

test("semantic foreground tokens pass WCAG AA against their filled backgrounds", () => {
  const light = effectiveTheme(false);
  const dark = effectiveTheme(true);
  for (const [mode, block] of [["light", light], ["dark", dark]]) {
    const pairs = [
      ["--color-on-accent", "--color-accent"],
      ["--color-on-status", "--color-warn"],
      ["--color-on-vibrant", "--color-calendar"],
      ["--color-on-vibrant", "--color-meals"],
      ["--color-on-vibrant", "--color-shopping"],
      ["--color-on-vibrant", "--color-chat"],
    ];
    for (const [foregroundName, backgroundName] of pairs) {
      const foreground = tokenValue(block, foregroundName);
      const background = tokenValue(block, backgroundName);
      assert.ok(foreground && background, `${mode}: missing ${foregroundName} or ${backgroundName}`);
      const ratio = contrastRatio(foreground, background);
      assert.ok(ratio >= 4.5, `${mode}: ${foregroundName} on ${backgroundName} is ${ratio.toFixed(2)}:1; expected at least 4.5:1`);
    }
  }
});

test("category components use WCAG AA soft-surface and strong-foreground pairs", () => {
  const light = effectiveTheme(false);
  const dark = effectiveTheme(true);
  for (const [mode, block] of [["light", light], ["dark", dark]]) {
    for (const category of ["calendar", "meals", "shopping", "chat", "finance", "family"]) {
      const foreground = tokenValue(block, `--color-${category}-strong`);
      const background = tokenValue(block, `--color-${category}-soft`);
      assert.ok(foreground && background, `${mode}: missing ${category} soft/strong pairing`);
      const ratio = contrastRatio(foreground, background);
      assert.ok(ratio >= 4.5, `${mode}: ${category} strong on soft is ${ratio.toFixed(2)}:1; expected at least 4.5:1`);
    }
  }
});

test("src/theme/famos-tokens.css keeps all three :root[data-daypart=…] overrides for --sunrise-gradient", () => {
  for (const part of ["morning", "day", "evening"]) {
    assert.ok(
      new RegExp(`:root\\[data-daypart="${part}"\\]`).test(tokensBare),
      `:root[data-daypart="${part}"] override missing from src/theme/famos-tokens.css`,
    );
  }
  const defaultGradient = tokensBare.match(/--sunrise-gradient:\s*([^;]+)/)?.[1];
  for (const part of ["morning", "day", "evening"]) {
    const rule = postcss.parse(tokensBare).nodes.find((node) => node.selector === `:root[data-daypart="${part}"]`);
    const gradient = rule.nodes.find((node) => node.prop === "--sunrise-gradient")?.value;
    assert.match(gradient, /^linear-gradient\(120deg,/);
    assert.equal(gradient.match(/#[0-9A-Fa-f]{6}/g)?.length, 5, part + " must retain five colour stops");
    if (part === "day") assert.equal(gradient, defaultGradient);
  }
});

test("src/index.css no longer declares the @theme block (moved to tokens file)", () => {
  assert.equal(
    index.match(/@theme\s*\{/g)?.length ?? 0,
    0,
    "src/index.css should not declare @theme block — it lives in src/theme/famos-tokens.css",
  );
});

test("src/index.css no longer declares the inline daypart selectors (moved to tokens file)", () => {
  for (const part of ["morning", "day", "evening"]) {
    assert.equal(
      indexBare.match(new RegExp(`:root\\[data-daypart="${part}"\\]`, "g"))?.length ?? 0,
      0,
      `src/index.css should not declare :root[data-daypart="${part}"] — it lives in src/theme/famos-tokens.css`,
    );
  }
});

test("src/index.css consumes the shared Untitled UI-derived radius scale", () => {
  // Legacy 14px/18px radii should stay rare now that controls and containers
  // use the 8px/12px Untitled UI-derived semantic tokens. Full pills remain valid
  // for avatars, status counters, and other genuinely circular UI.
  const rawMd = (index.match(/border-radius:14px/g) || []).length;
  const rawSection = (index.match(/border-radius:18px/g) || []).length;
  assert.ok(
    rawMd + rawSection <= 6,
    `expected legacy 14px/18px radii to stay exceptional; saw md=${rawMd} section=${rawSection}`,
  );
  // Confirm readers exist in src/index.css.
  assert.ok(/border-radius:var\(--radius-pill\)/.test(index), "var(--radius-pill) reader missing in src/index.css");
  assert.ok(/border-radius:var\(--radius-control\)/.test(index), "var(--radius-control) reader missing in src/index.css");
  assert.ok(/border-radius:var\(--radius-card\)/.test(index), "var(--radius-card) reader missing in src/index.css");
});
