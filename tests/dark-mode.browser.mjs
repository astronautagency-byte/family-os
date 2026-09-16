import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage();
 for(const width of [402,1280]) {
  await page.setViewportSize({width,height:874});
  await page.goto('http://127.0.0.1:5173/tests/visual-regression/ux-review.html');
  await page.getByRole('button',{name:'Dark mode',exact:true}).click();
  // Test the shipped cascade on representative page surfaces and actions.
  await page.evaluate(()=>{
   const host=document.createElement('section');
   host.id='dark-regression';host.style='display:grid;gap:12px;padding:16px';
   for(const name of ['fam-ai-workspace','fam-ai-composer','task-board-group','meal-card-new','grocery-list-row','kw-card','saved-recipe-card','chat-mobile-composer','settings-card','family-broadcast-composer']){
    const panel=document.createElement('div');panel.className=name;panel.dataset.surface=name;panel.textContent=name;panel.style.padding='16px';host.append(panel);
   }
   for(const name of ['primary-button','broadcast-send-button','fam-ai-composer-send','task-inline-submit','completion-confirm']){
    const button=document.createElement('button');button.className=name;button.dataset.action=name;button.textContent='Continue';host.append(button);
   }
   document.querySelector('.app-content').append(host);
  });
  for(const scheme of ['famos','ocean','forest']) {
   await page.evaluate(scheme=>{document.documentElement.dataset.colorScheme=scheme;document.querySelector('.app-shell').dataset.colorScheme=scheme;},scheme);
   const readings=await page.locator('#dark-regression [data-surface], #dark-regression [data-action]').evaluateAll(elements=>elements.map(el=>{
    const style=getComputedStyle(el);
    const lum=rgb=>{const c=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
    const a=lum(style.color),b=lum(style.backgroundColor);
    return {name:el.dataset.surface||el.dataset.action,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),background:style.backgroundColor};
   }));
   for(const reading of readings)assert.ok(reading.ratio>=4.5,JSON.stringify({width,scheme,...reading}));
  }
  // Modal is portalled outside .app-shell: it must inherit dark surfaces too.
  await page.getByRole('button',{name:'Add task',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.evaluate(async el=>{await Promise.all(el.getAnimations().map(animation=>animation.finished));});
  assert.equal(await dialog.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(25, 40, 34)');
  assert.equal(await dialog.evaluate(el=>getComputedStyle(el).color),'rgb(243, 247, 245)');
  await page.screenshot({path:`tests/visual-regression/dark-mode-${width}.png`,fullPage:true});
  await dialog.getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('button',{name:'Light mode',exact:true}).click();
  assert.equal(await page.locator('html').evaluate(el=>getComputedStyle(el).colorScheme),'light');
 }
 console.log('Dark surfaces, action contrast in three schemes, portal dialog and theme switching passed at mobile and desktop widths.');
} finally {await browser.close();}
