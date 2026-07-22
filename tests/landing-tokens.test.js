import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const tokensPath = resolve(root, "src", "theme", "landing-tokens.css");
const landingPath = resolve(root, "src", "landing.css");
const tokens = readFileSync(tokensPath, "utf8");
const landing = readFileSync(landingPath, "utf8");

function stripCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

const tokensBare = stripCssComments(tokens);
const landingBare = stripCssComments(landing);

test("src/theme/landing-tokens.css exists and is non-empty", () => {
  assert.ok(tokens.length > 1000, `tokens file too small (${tokens.length} bytes)`);
});

test("src/theme/landing-tokens.css imports FAMOS tokens (no silent loss of shared primitives)", () => {
  assert.ok(
    /@import\s+["']\.\/famos-tokens\.css["']\s*;?/.test(tokensBare),
    "src/theme/landing-tokens.css must @import ./famos-tokens.css",
  );
});

test("src/landing.css cascade axiom: tokens imported BEFORE any component rule", () => {
  const importIdx = landing.indexOf("@import \"./theme/landing-tokens.css\"");
  assert.ok(importIdx > -1, "@import ./theme/landing-tokens.css missing from src/landing.css");
  const firstRule = landing.indexOf(".landing-float-note");
  assert.ok(importIdx < firstRule, "tokens import must come BEFORE the first component rule");
});

test("src/theme/landing-tokens.css declares every landing-* brand + structural token", () => {
  const required = [
    // Brand palette
    ["--landing-color-primary", "#7952E8"],
    ["--landing-color-primary-dark", "#5741C9"],
    ["--landing-color-surface-dark", "#17171F"],
    ["--landing-color-text-muted", "#625E69"],
    ["--landing-color-stage", "#FFF0A8"],
    ["--landing-color-pink", "#F45D9A"],
    // Lavender / cream / gray / sage variations
    ["--landing-color-lavender-soft", "#EEE8FF"],
    ["--landing-color-lavender-cool", "#F5F1FF"],
    ["--landing-color-lavender-mid",  "#F8F4FF"],
    ["--landing-color-cream-step",    "#FFF8E8"],
    ["--landing-color-cream-intro",   "#F4F0FF"],
    ["--landing-color-gray",          "#D7D2E2"],
    ["--landing-color-gray-muted",    "#6D6874"],
    ["--landing-color-sage-solid",    "#397B66"],
    // Radii
    ["--landing-radius-stage", "28px"],
    ["--landing-radius-preview", "26px"],
    ["--landing-radius-hero", "38px"],
    // Section padding
    ["--landing-section-pad-y", "110px"],
    ["--landing-section-pad-x", "28px"],
    ["--landing-section-pad-y-mobile", "76px"],
    ["--landing-section-pad-x-mobile", "18px"],
    // CTA padding
    ["--landing-cta-pad-y", "13px"],
    ["--landing-cta-pad-x", "20px"],
  ];
  for (const [name, value] of required) {
    assert.ok(
      tokensBare.includes(`${name}: ${value}`),
      `landing token \`${name}: ${value}\` not declared in src/theme/landing-tokens.css`,
    );
  }
});

test("dead tokens that were removed in the latest revision stay removed", () => {
  // Verified orphan: declared without a reader in src/landing.css.
  for (const dead of [
    "--landing-color-cream-feature",
    "--landing-color-sage-200",
    "--landing-color-sage-500",
    "--landing-color-sage-600",
    "--landing-color-sage-700",
    "--landing-text-eyebrow",
    "--landing-text-meta",
    "--landing-pill-pad-y",
    "--landing-pill-pad-x",
  ]) {
    assert.ok(
      !tokensBare.includes(`${dead}:`),
      `\`${dead}\` should not be re-introduced — it has no reader in src/landing.css`,
    );
  }
});

test("three breakpoint tokens are declared at :root level (testable, not buried in a comment)", () => {
  for (const [name, value] of [
    ["--landing-bp-tablet", "900px"],
    ["--landing-bp-nav", "700px"],
    ["--landing-bp-mobile", "600px"],
  ]) {
    assert.ok(
      tokensBare.includes(`${name}: ${value}`),
      `breakpoint token \`${name}: ${value}\` must be declared at :root level so it's testable`,
    );
  }
});

test("src/landing.css hex sweep landed: prominent duplicates fully eliminated", () => {
  // Twelve prominent hexes were swept; all should be zero remaining.
  for (const oldHex of [
    "#7952e8", "#17171f", "#17172f", "#625e69", "#fff0a8", "#f45d9a",
    "#fbf8ff", "#228766", "#5741c9", "#3d8a70",
    "#dff5e9", "#e5ddf5", "#f4f0ff", "#fff8e8",
  ]) {
    const remaining = (landingBare.match(new RegExp(oldHex, "g")) || []).length;
    assert.equal(
      remaining,
      0,
      `literal hex \`${oldHex}\` should be swept to a var(--landing-*) reader (found ${remaining} remaining in src/landing.css)`,
    );
  }
  // Second wave: lavender / gray / sage / pink-pastel sweeps
  for (const oldHex of ["#eee8ff", "#f5f1ff", "#f8f4ff", "#d7d2e2", "#6d6874", "#397b66"]) {
    const remaining = (landingBare.match(new RegExp(oldHex, "g")) || []).length;
    assert.equal(
      remaining,
      0,
      `literal hex \`${oldHex}\` should be swept to a var(--landing-color-*) reader (found ${remaining} remaining)`,
    );
  }
});

test("src/landing.css radius sweep landed: prominent duplicates fully eliminated", () => {
  for (const oldPx of [
    "border-radius:999px", "border-radius:16px", "border-radius:24px",
    "border-radius:18px", "border-radius:13px", "border-radius:28px",
    "border-radius:38px", "border-radius:26px",
  ]) {
    const remaining = (landingBare.match(new RegExp(oldPx, "g")) || []).length;
    assert.equal(
      remaining,
      0,
      `literal \`${oldPx}\` should be fully swept (found ${remaining} remaining)`,
    );
  }
});

test("src/landing.css section-padding sweep landed for the two prominent shapes", () => {
  for (const oldPad of ["padding:110px 28px", "padding:76px 18px"]) {
    const remaining = (landingBare.match(new RegExp(oldPad, "g")) || []).length;
    assert.equal(
      remaining,
      0,
      `literal \`${oldPad}\` should be fully swept (found ${remaining} remaining)`,
    );
  }
});

test("every landing-specific token declared has at least one var(--landing-*) reader in src/landing.css", () => {
  // Walk the source of truth: the tokens file declares var(--landing-*)
  // references and we expect each token name to appear as a var() read in
  // landing.css. This is the orphan-token guard.
  const declaredNames = (tokensBare.match(/--landing-[a-z0-9-]+/g) || [])
    .filter((name, idx, arr) => arr.indexOf(name) === idx);
  for (const name of declaredNames) {
    // Skip the breakpoints — they don't have a var() reader because @media
    // can't read CSS variables per spec; they're documented constants.
    if (name.startsWith("--landing-bp-")) continue;
    const reader = `var(${name})`;
    assert.ok(
      landingBare.includes(reader),
      `\`${reader}\` must appear at least once in src/landing.css — token declared in landing-tokens.css has no caller (would be an orphan declaration)`,
    );
  }
});

test("pre-existing --landing-phone-* mobile overrides still resolve (declared just-in-time inside @media)", () => {
  assert.ok(
    /--landing-phone-gutter\s*:\s*16px/.test(landingBare),
    "--landing-phone-gutter (16px) must remain declared inside the mobile @media block in src/landing.css",
  );
  assert.ok(
    /--landing-phone-section\s*:\s*64px/.test(landingBare),
    "--landing-phone-section (64px) must remain declared inside the mobile @media block in src/landing.css",
  );
});
