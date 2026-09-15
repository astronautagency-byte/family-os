import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:5173/tests/visual-regression/family-cards.html');
 await page.getByRole('button',{name:'Preview shopping celebration',exact:true}).click();
 await page.locator('[data-famos-confetti]').waitFor();
 assert.equal(await page.locator('[data-famos-confetti]').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 await page.getByRole('dialog').locator('img').evaluate(img=>img.decode());
 await page.screenshot({path:'tests/visual-regression/celebration-canvas-mobile.png'});
 await page.keyboard.press('Escape');
 assert.equal(await page.getByRole('dialog').count(),0);
 assert.equal(await page.locator('[data-famos-confetti]').count(),0);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByRole('button',{name:'Preview task celebration',exact:true}).click();
 assert.equal(await page.locator('[data-famos-confetti]').count(),0);
 assert.equal(await page.locator('.completion-content').evaluate(el=>getComputedStyle(el).animationName),'none');
 await page.getByRole('button',{name:'Awesome!',exact:true}).click();
 assert.deepEqual(errors,[]);
 console.log('Real canvas confetti, mobile dialog, close cleanup and reduced motion checks passed.');
}finally{await browser.close();}
