import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try {
 const context=await browser.newContext({permissions:['microphone'],viewport:{width:390,height:844}});
 const page=await context.newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/tests/visual-regression/family-cards.html');
 await page.getByRole('button',{name:'Record voice note',exact:true}).click();
 await page.getByRole('button',{name:'Stop recording',exact:true}).waitFor();
 await page.waitForTimeout(1500);
 await page.getByRole('button',{name:'Stop recording',exact:true}).click();
 const audio=page.locator('audio'); await audio.waitFor({state:'attached'});
 await page.waitForFunction(()=>document.querySelector('audio')?.readyState>=2);
 await page.locator('.voice-note-waveform').waitFor();
 assert.equal(await page.getByRole('slider',{name:'Seek voice note'}).isEnabled(),true,'decoded recording has a finite seekable duration');
 await page.screenshot({path:'tests/visual-regression/voice-note-player-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Play voice note',exact:true}).click();
 await page.getByRole('button',{name:'Pause voice note',exact:true}).waitFor();
 assert.equal(await audio.evaluate(el=>el.paused),false,'recorded blob is playable');
 await page.getByRole('button',{name:'Pause voice note',exact:true}).click();
 assert.equal(await audio.evaluate(el=>el.paused),true);
 await page.getByRole('button',{name:'Playback speed 1 times'}).click();
 assert.equal(await audio.evaluate(el=>el.playbackRate),1.5);
 await page.getByRole('button',{name:'Remove voice note'}).click();
 assert.equal(await audio.count(),0);
 await page.getByRole('button',{name:'Record voice note',exact:true}).click();
 await page.getByRole('button',{name:'Stop recording',exact:true}).waitFor();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.equal(await audio.count(),0,'cancel discards draft');
 for(const header of await page.locator('.family-page-header').all()) {
   const art=header.locator('img'); assert.equal(await art.isVisible(),true,'all feature headers have visible art');
   assert.equal(await art.evaluate(el=>el.getBoundingClientRect().width),60);
 }
 await page.screenshot({path:'tests/visual-regression/header-voice-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Real MediaRecorder: record, stop, decode, playback, remove, cancel; mobile header art passed. Synthetic microphone only.');
} finally {await browser.close();}
