import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try{
 const page=await browser.newPage({permissions:['microphone'],viewport:{width:390,height:844}});
 await page.goto('http://127.0.0.1:5173/tests/visual-regression/broadcast.html');
 await page.getByLabel('Broadcast a message to the family').fill('Text test');
 await page.getByRole('button',{name:'Send text broadcast'}).click();
 assert.equal(await page.getByRole('status').innerText(),'Text test');
 await page.getByRole('button',{name:'Voice note',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Stop recording'}).count(),0,'switching tabs does not record');
 await page.getByRole('button',{name:'Record voice note',exact:true}).click();
 await page.getByRole('button',{name:'Stop recording'}).waitFor();
 await page.waitForFunction(()=>document.querySelector('meter')?.value>0);
 await page.getByRole('button',{name:'Stop recording'}).click();
 await page.locator('audio').waitFor({state:'attached'});
 assert.equal(await page.getByRole('button',{name:'Send voice note'}).isDisabled(),false,'audio can send without transcript');
 await page.getByText('Add text (optional)',{exact:true}).click();
 await page.getByLabel('Voice note text').fill('Voice message text');
 await page.getByRole('button',{name:'Send voice note'}).click();
 assert.equal(await page.getByRole('status').innerText(),'Voice message text');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'tests/visual-regression/broadcast-compact.png',fullPage:true});
 console.log('Manual recording only, live signal, audio-only readiness and optional caption submit passed (local synthetic audio).');
}finally{await browser.close();}
