import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 for(const width of [390,1280]) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/tests/visual-regression/ux-review.html');
  await page.getByRole('button',{name:'Add task',exact:true}).click();
  await page.getByLabel('Task',{exact:true}).fill('Make room around controls');
  await page.getByRole('dialog').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});
  const gap=await page.getByRole('dialog').evaluate(el=>{
   const field=el.querySelector('.form-field').getBoundingClientRect();
   const button=el.querySelector('.m3-button').getBoundingClientRect();
   return button.top-field.bottom;
  });
  assert.ok(gap>=16,`dialog field/action gap: ${gap}`);
  await page.getByRole('dialog').getByRole('button',{name:'Add task',exact:true}).click();
  assert.equal(await page.locator('.task-board-row').evaluate(el=>getComputedStyle(el).paddingTop),'16px');
  assert.equal(await page.locator('.task-board-group').evaluate(el=>getComputedStyle(el).paddingLeft),width<=640?'12px':'16px');
  assert.equal(await page.locator('.task-board-list').evaluate(el=>getComputedStyle(el).rowGap),'12px');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`tests/visual-regression/spacing-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Dark mode'}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  await page.close();
 }
 console.log('Mobile/desktop spacing, dialog action gap, task padding and light/dark overflow checks passed.');
} finally {await browser.close();}
