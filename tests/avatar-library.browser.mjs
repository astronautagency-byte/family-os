import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:5173/tests/visual-regression/family-cards.html');
 const picker=page.locator('.illustrated-avatar-picker');
 await picker.waitFor();
 await picker.scrollIntoViewIfNeeded();
 const images=picker.locator('img');
 assert.equal(await images.count(),22);
 await images.evaluateAll(async nodes=>Promise.all(nodes.map(node=>node.decode())));
 await picker.getByRole('button',{name:'Older adults',exact:true}).click();
 assert.equal(await picker.getByRole('button',{name:/^Choose /}).count(),6);
 await picker.getByRole('button',{name:'Choose Long silver braid'}).click();
 assert.equal(await picker.getByRole('button',{name:'Choose Long silver braid'}).getAttribute('aria-pressed'),'true');
 await picker.getByRole('button',{name:'All',exact:true}).click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await picker.screenshot({path:'tests/visual-regression/avatar-library-expanded.png'});
 console.log('22 images decoded; age filter, explicit selection and mobile overflow checks passed.');
} finally {await browser.close();}
