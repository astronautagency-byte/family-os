import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ui = readFileSync(resolve(root, "src/components/ui.jsx"), "utf8");
const css = readFileSync(resolve(root, "src/index.css"), "utf8");

test("the Untitled UI interaction families have shared FamOS components", () => {
  for (const name of [
    "PrimaryButton", "SecondaryButton", "IconButton", "TextField",
    "SelectField", "TextAreaField", "DateField", "Modal", "Tag",
    "ProgressBar", "Alert", "SegmentedControl", "AvatarCircles",
  ]) {
    assert.match(ui, new RegExp(`export function ${name}\\b`), `${name} is missing from the shared UI layer`);
  }
});

test("shared fields implement visible focus, disabled and hint states", () => {
  assert.match(css, /\.form-control:focus-visible/);
  assert.match(css, /\.form-control:disabled/);
  assert.match(css, /\.form-hint/);
  assert.match(css, /\.ui-select/);
  assert.match(css, /\.ui-textarea/);
});

test("browser-native date inputs do not bypass the shared date picker", () => {
  const files = ["Auth.jsx", "Calendar.jsx", "Groceries.jsx", "Tasks.jsx"];
  for (const file of files) {
    const source = readFileSync(resolve(root, "src/pages", file), "utf8");
    assert.doesNotMatch(source, /type=["']date["']/, `${file} contains a native date input`);
  }
});
