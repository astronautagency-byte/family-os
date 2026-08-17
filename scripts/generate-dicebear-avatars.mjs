// Generates the FamOS avatar preset gallery from DiceBear (https://www.dicebear.com).
// Fetches deterministic SVG avatars for a curated set of styles/seeds, writes them to
// public/avatars/, and regenerates src/data/avatarLibrary.js from the same list.
//
// Usage: node scripts/generate-dicebear-avatars.mjs
// Requires network access to api.dicebear.com. The output is committed so the app
// never depends on the DiceBear API at runtime (PWA/offline safe).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "avatars");
const LIBRARY_FILE = path.join(ROOT, "src", "data", "avatarLibrary.js");

// style -> seed names. Each seed produces a different deterministic face.
const STYLES = {
  adventurer: ["Maya", "Noah", "Priya", "Kai", "Sofia", "Liam", "Amara", "Eli", "Zoe", "Omar"],
  "adventurer-neutral": ["June", "Theo", "Nadia", "Isaac", "Lena", "Arlo", "Cleo", "Ravi"],
  personas: ["Sam", "Ines", "Marco", "Hana", "Diego", "Ayla", "Nico", "Freya"],
  lorelei: ["Wren", "Idris", "Mira", "Soren", "Anouk", "Felix", "Rosa", "Hiro"],
  miniavs: ["Bo", "Ivy", "Zeke", "Nia", "Otis", "Uma"],
  micah: ["Jade", "Micah", "Sky", "Ren"],
  "open-peeps": ["Pia", "Milo", "Sasha", "Yara"],
};

const API = "https://api.dicebear.com/9.x";

const presets = [];
for (const [style, seeds] of Object.entries(STYLES)) {
  for (const seed of seeds) {
    const slug = `${style}-${seed.toLowerCase()}`;
    presets.push({ id: `dicebear-${slug}`, label: seed, style, seed, file: `dicebear-${slug}.svg` });
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let failed = 0;

  for (const preset of presets) {
    const url = `${API}/${preset.style}/svg?seed=${encodeURIComponent(preset.seed)}&backgroundColor=transparent`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`FAIL ${preset.id}: HTTP ${res.status}`);
      failed += 1;
      continue;
    }
    const svg = await res.text();
    await writeFile(path.join(OUT_DIR, preset.file), svg);
    console.log(`ok   ${preset.file} (${svg.length} bytes)`);
  }

  const styleNames = Object.keys(STYLES);
  const library = `// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/generate-dicebear-avatars.mjs
// Avatars are deterministic DiceBear SVGs (https://www.dicebear.com) checked into
// public/avatars so the app works offline. Photo upload and initials remain available
// alongside these presets in the avatar editor.
export const AVATAR_PRESETS = [
${presets
  .map((p) => `  { id: "${p.id}", label: "${p.label}", url: "/avatars/${p.file}" },`)
  .join("\n")}
];

// Styles used by the preset gallery above.
const DICEBEAR_STYLES = ${JSON.stringify(styleNames)};

// Returns a fresh, random DiceBear avatar URL (fetched from the DiceBear API at
// runtime). Used by the "Surprise me" re-roll in the avatar editors.
export function randomDiceBearAvatarUrl() {
  const style = DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)];
  const seed = Math.random().toString(36).slice(2, 10);
  return \`https://api.dicebear.com/9.x/\${style}/svg?seed=\${seed}&backgroundColor=transparent\`;
}
`;

  await writeFile(LIBRARY_FILE, library);
  console.log(`\nWrote ${presets.length - failed}/${presets.length} avatars to public/avatars/`);
  console.log(`Regenerated src/data/avatarLibrary.js (${presets.length} presets)`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});