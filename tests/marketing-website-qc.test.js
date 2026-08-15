import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const landingCss = readFileSync(resolve(root, "src/landing.css"), "utf8");
const featureCss = readFileSync(resolve(root, "src/feature.css"), "utf8");
const featureData = readFileSync(resolve(root, "src/data/featureData.js"), "utf8");

test("website eyebrow and feature icons keep content-sized geometry", () => {
  assert.match(landingCss, /\.landing-page \.landing-kicker,[\s\S]*?width:max-content/);
  assert.match(landingCss, /\.landing-page \.purpose-grid article>svg\{[\s\S]*?width:44px!important;[\s\S]*?height:44px!important/);
});

test("product phone crop, feature-token spacing and CTAs share deliberate sizing", () => {
  assert.match(featureCss, /\.feature-hero-pills\{[^}]*margin-bottom:44px/);
  assert.match(featureCss, /\.feature-hero-phone\.is-composite\{width:270px;height:565px;overflow:hidden/);
  assert.match(featureCss, /One marketing button scale across module heroes and closing CTAs/);
  assert.match(landingCss, /\.landing-page :is\(\.landing-hero-ctas,\.purpose-actions\) button\{[\s\S]*?height:48px/);
});

test("calendar marketing no longer advertises the disabled local event finder", () => {
  assert.doesNotMatch(featureData, /Find events nearby|Find something fun nearby|Searching Newmarket/);
  assert.match(featureData, /Shared family views/);
});
