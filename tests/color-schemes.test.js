import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { APP_COLOR_SCHEMES } from '../src/data/appColorSchemes.js';

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/pages/Settings.jsx", import.meta.url), "utf8");
const schemes = readFileSync(new URL("../src/data/appColorSchemes.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("app colour scheme persists and is applied to the signed-in shell", () => {
  assert.match(app, /familyos:color-scheme/);
  assert.match(app, /data-color-scheme=\{colorScheme\}/);
  assert.match(app, /onColorSchemeChange=\{setColorScheme\}/);
});

const schemeIds = APP_COLOR_SCHEMES.map(scheme => scheme.id);

test("Settings exposes curated accessible palettes", () => {
  for (const scheme of schemeIds) assert.match(schemes, new RegExp(`id: "${scheme}"`));
  assert.ok(schemeIds.length >= 9);
  assert.equal(new Set(schemeIds).size, schemeIds.length);
  assert.match(settings, /<ColorSchemePicker/);
});

test("every alternate palette has light and dark token overrides", () => {
  for (const scheme of schemeIds.filter((scheme) => scheme !== "famos")) {
    const accents = readFileSync(new URL("../src/theme/scheme-accents.css", import.meta.url), "utf8");
    assert.match(accents, new RegExp(`app-shell\\[data-color-scheme="${scheme}"\\]`));
    assert.match(accents, new RegExp(`theme-dark\\[data-color-scheme="${scheme}"\\]`));
  }
});
