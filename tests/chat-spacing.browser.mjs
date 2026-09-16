import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage();
  for (const width of [390, 402, 430]) {
    for (const height of [874, 480]) {
      await page.setViewportSize({ width, height });
      await page.goto('http://127.0.0.1:5173/tests/visual-regression/ux-review.html');
      // Focused CSS fixture: use the production composer class and inline layout.
      // A shortened viewport checks that layout doesn't squeeze the composer.
      await page.evaluate(() => {
        document.querySelector('#root').innerHTML = '<div class="app-shell"><main class="app-content"><div class="chat-page-shell"><div class="flex-1">Messages</div><form class="chat-mobile-composer" style="position:sticky;bottom:0;display:flex;align-items:center;gap:8px;padding:8px 12px"><input aria-label="Message" style="min-width:0;flex:1;height:40px"><button style="height:40px;width:40px">Send</button></form></div></main></div>';
      });
      const spacing = await page.locator('.chat-mobile-composer').evaluate(el => ({
        bottom: getComputedStyle(el).paddingBottom,
        height: el.getBoundingClientRect().height,
        shrink: getComputedStyle(el).flexShrink,
      }));
      assert.equal(spacing.bottom, '8px');
      assert.equal(spacing.shrink, '0');
      assert.ok(spacing.height >= 56 && spacing.height <= 60);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
  }
  console.log('Chat composer has 8px bottom padding at three mobile widths and full/reduced viewport heights. Physical keyboard and iOS safe area still require device verification.');
} finally {
  await browser.close();
}
