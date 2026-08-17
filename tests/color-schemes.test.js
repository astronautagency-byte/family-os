import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/pages/Settings.jsx", import.meta.url), "utf8");
const schemes = readFileSync(new URL("../src/data/appColorSchemes.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("app colour scheme persists and is applied to the signed-in shell", () => {
  assert.match(app, /familyos:color-scheme/);
  assert.match(app, /data-color-scheme=\{colorScheme\}/);
  assert.match(app, /onColorSchemeChange=\{setColorScheme\}/);
});

const schemeIds = ["famos", "ocean", "berry", "forest", "sunset", "mist", "sage", "clay", "harbour"];

test("Settings exposes curated accessible palettes", () => {
  for (const scheme of schemeIds) assert.match(schemes, new RegExp(`id: "${scheme}"`));
  assert.match(settings, /role="listbox" aria-label="App colour schemes"/);
  assert.match(settings, /settings-color-select/);
  assert.match(settings, /scheme-swatches/);
});

test("every alternate palette has light and dark token overrides", () => {
  for (const scheme of schemeIds.filter((scheme) => scheme !== "famos")) {
    assert.match(css, new RegExp(`app-shell\\[data-color-scheme="${scheme}"\\]`));
    assert.match(css, new RegExp(`theme-dark\\[data-color-scheme="${scheme}"\\]`));
  }
});
