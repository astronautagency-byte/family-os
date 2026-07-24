#!/usr/bin/env node
/**
 * FamOS Visual Regression — Form Variants
 *
 * Compares screenshots of admin form controls against app form controls
 * to detect visual drift. Uses Playwright for headless screenshot capture.
 *
 * Usage:
 *   node tests/visual-regression/compare-forms.mjs              # capture + compare
 *   node tests/visual-regression/compare-forms.mjs --update-baseline  # update baselines
 *
 * Requires: npx playwright install chromium  (first run only)
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname, basename as pathBasename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = join(__dirname, "baselines");
const CURRENT_DIR = join(__dirname, "current");
const DIFF_DIR = join(__dirname, "diffs");
const FIXTURE_PATH = join(__dirname, "form-variants-fixture.html");

const UPDATE_BASELINE = process.argv.includes("--update-baseline");

// Threshold: max allowed pixel difference percentage before flagging a regression
const PIXEL_DIFF_THRESHOLD = 0.5;

// Form variants to capture — each maps to a section in the fixture
const VARIANTS = [
  { id: "app-input-default",   label: "App Input (default)" },
  { id: "app-input-focus",     label: "App Input (focus)" },
  { id: "app-select",          label: "App Select" },
  { id: "app-pill-buttons",    label: "App Pill Buttons" },
  { id: "admin-input-default", label: "Admin Input (default)" },
  { id: "admin-input-focus",   label: "Admin Input (focus)" },
  { id: "admin-select",        label: "Admin Select" },
  { id: "admin-pill-buttons",  label: "Admin Pill Buttons" },
  { id: "admin-disabled",      label: "Admin Disabled States" },
  { id: "side-by-side",        label: "Side-by-side Comparison" },
];

// Themes to test
const THEMES = ["light", "dark"];

async function captureScreenshots(page) {
  const results = [];

  for (const theme of THEMES) {
    // Toggle theme via data attributes (robust — no text matching)
    await page.evaluate((t) => {
      if (window.__setTheme) {
        const btn = document.querySelector(`[data-theme="${t}"]`);
        if (btn) window.__setTheme(t, btn);
      } else {
        document.documentElement.classList.toggle("theme-dark", t === "dark");
      }
    }, theme);

    // Wait for transition
    await page.waitForTimeout(300);

    for (const variant of VARIANTS) {
      const selector = `[data-variant="${variant.id}"]`;
      const element = await page.$(selector);
      if (!element) {
        console.warn(`  ⚠ Skipping ${variant.id} (${theme}) — not found`);
        continue;
      }

      const filename = `${variant.id}__${theme}.png`;
      const dir = UPDATE_BASELINE ? BASELINE_DIR : CURRENT_DIR;

      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      await element.screenshot({ path: join(dir, filename), omitBackground: false });
      results.push({ variant: variant.id, theme, filename, path: join(dir, filename) });
    }
  }

  return results;
}

// Simple pixel-by-pixel comparison using raw PNG buffers
// Falls back to file-size comparison when pixelmatch isn't available
async function compareImages(currentPath, baselinePath) {
  try {
    const currentBuf = readFileSync(currentPath);
    const baselineBuf = readFileSync(baselinePath);

    // Quick check: identical bytes = no diff
    if (currentBuf.equals(baselineBuf)) {
      return { identical: true, diffPercent: 0 };
    }

    // Try pixelmatch if available
    try {
      const pixelmatch = (await import("pixelmatch")).default;
      const { PNG } = await import("pngjs");

      const currentPng = PNG.sync.read(currentBuf);
      const baselinePng = PNG.sync.read(baselineBuf);

      // Resize to match if different dimensions
      if (currentPng.width !== baselinePng.width || currentPng.height !== baselinePng.height) {
        return {
          identical: false,
          diffPercent: 100,
          reason: `Dimension mismatch: ${currentPng.width}x${currentPng.height} vs ${baselinePng.width}x${baselinePng.height}`,
        };
      }

      const diff = new PNG({ width: currentPng.width, height: currentPng.height });
      const diffPixels = pixelmatch(
        currentPng.data, baselinePng.data, diff.data,
        currentPng.width, currentPng.height,
        { threshold: 0.1 }
      );

      const totalPixels = currentPng.width * currentPng.height;
      const diffPercent = (diffPixels / totalPixels) * 100;

      // Save diff image if there are differences
      if (diffPixels > 0) {
        if (!existsSync(DIFF_DIR)) mkdirSync(DIFF_DIR, { recursive: true });
        const diffPath = join(DIFF_DIR, pathBasename(currentPath));
        writeFileSync(diffPath, PNG.sync.write(diff));
      }

      return { identical: diffPixels === 0, diffPercent, diffPixels };
    } catch {
      // pixelmatch not installed — fall back to file-size ratio
      const sizeDiff = Math.abs(currentBuf.length - baselineBuf.length) / baselineBuf.length * 100;
      return { identical: false, diffPercent: sizeDiff, reason: "pixelmatch not installed — using file-size comparison" };
    }
  } catch (err) {
    return { identical: false, diffPercent: -1, reason: err.message };
  }
}



async function main() {
  console.log("🔍 FamOS Visual Regression — Form Variants\n");

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

  // Load fixture
  await page.goto(`file://${FIXTURE_PATH}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // Capture
  console.log("📸 Capturing screenshots…");
  const screenshots = await captureScreenshots(page);
  console.log(`   Captured ${screenshots.length} screenshots across ${THEMES.length} themes\n`);

  await browser.close();

  // Update baseline mode
  if (UPDATE_BASELINE) {
    console.log("✅ Baselines updated. Run again without --update-baseline to compare.\n");
    return;
  }

  // Compare against baselines
  if (!existsSync(BASELINE_DIR)) {
    console.log("⚠ No baselines found. Run with --update-baseline first:\n");
    console.log("   node tests/visual-regression/compare-forms.mjs --update-baseline\n");
    return;
  }

  console.log("🔬 Comparing against baselines…\n");
  let passed = 0;
  let failed = 0;
  let warnings = 0;
  const failures = [];

  for (const shot of screenshots) {
    const baselinePath = join(BASELINE_DIR, shot.filename);
    if (!existsSync(baselinePath)) {
      console.log(`  ⚠ ${shot.filename} — no baseline (new variant)`);
      warnings++;
      continue;
    }

    const result = await compareImages(shot.path, baselinePath);

    if (result.identical) {
      console.log(`  ✅ ${shot.filename}`);
      passed++;
    } else if (result.diffPercent <= PIXEL_DIFF_THRESHOLD) {
      console.log(`  ✅ ${shot.filename} (${result.diffPercent.toFixed(2)}% diff — within threshold)`);
      passed++;
    } else {
      console.log(`  ❌ ${shot.filename} (${result.diffPercent.toFixed(2)}% diff — EXCEEDS ${PIXEL_DIFF_THRESHOLD}% threshold)`);
      if (result.reason) console.log(`     ${result.reason}`);
      failed++;
      failures.push({ file: shot.filename, diff: result.diffPercent, reason: result.reason });
    }
  }

  // Summary
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${warnings} warnings`);
  console.log(`${"─".repeat(50)}\n`);

  if (failed > 0) {
    console.log("❌ Visual regressions detected:\n");
    for (const f of failures) {
      console.log(`  • ${f.file} — ${f.diff.toFixed(2)}% pixel diff${f.reason ? ` (${f.reason})` : ""}`);
    }
    console.log(`\nDiff images saved to: ${DIFF_DIR}/`);
    console.log("\nTo update baselines after reviewing:\n");
    console.log("  node tests/visual-regression/compare-forms.mjs --update-baseline\n");
    process.exit(1);
  } else {
    console.log("✅ All form variants match baselines. No visual regressions.\n");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
