import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/theme/contrast.css', import.meta.url), 'utf8');
const light = css.match(/:root\[data-famos-theme\],[\s\S]*?\{([\s\S]*?)\}/)?.[1];
const dark = css.match(/:root\[data-famos-theme="dark"\],[\s\S]*?\{([\s\S]*?)\}/)?.[1];

function value(block, name) {
  return block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
}
function luminance(hex) {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}
test('module text colours remain readable against their paired surfaces in both themes', () => {
  for (const [theme, block] of [['light', light], ['dark', dark]]) {
    assert.ok(block, `${theme} token block missing`);
    for (const module of ['calendar', 'tasks', 'meals', 'shopping', 'chat']) {
      const foreground = value(block, `color-${module}-strong`);
      const background = value(block, `color-${module}-soft`);
      assert.ok(foreground && background, `${theme} ${module} colours missing`);
      const a = luminance(foreground), b = luminance(background);
      assert.ok((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5, `${theme} ${module} contrast is below 4.5:1`);
    }
  }
});
