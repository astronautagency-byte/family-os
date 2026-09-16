// First export the actual React DOM with FAMOS_UI_SNAPSHOT=/tmp/famos-appearance-snapshots.json
// npx vitest run src/pages/Appearance.regression.test.jsx
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const snapshots=JSON.parse(readFileSync('/tmp/famos-appearance-snapshots.json','utf8'));
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage();
 for(const width of [375,402,768,1280]) for(const theme of ['light','dark']) {
  await page.setViewportSize({width,height:900});
  for(const [name,markup] of Object.entries(snapshots)) {
   await page.goto('http://127.0.0.1:5173/tests/visual-regression/ux-review.html');
   await page.waitForSelector('.app-content');
   await page.evaluate(({markup,theme})=>{
    document.documentElement.dataset.famosTheme=theme;
    document.documentElement.dataset.colorScheme='forest';
    document.body.innerHTML=`<main class="app-shell ${theme==='dark'?'theme-dark':''}" data-color-scheme="forest" style="display:block"><div class="app-content" style="margin:0;width:100%;max-width:none">${markup}</div></main>`;
    document.querySelectorAll('.m3-dialog-layer').forEach(el=>document.body.append(el));
    // Finish Framer's initial state in this static DOM capture.
    document.querySelectorAll('[style]').forEach(el=>{if(el.style.opacity==='0')el.style.opacity='1';if(el.style.transform)el.style.transform='none';});
   },{markup,theme});
   await page.waitForTimeout(500);
   if(name==='meals') {
    const boxes=await page.locator('.meal-plan-toolbar > button,.meal-plan-toolbar > .meal-range-toggle').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width};}));
    for(const b of boxes)assert.ok(b.x>=0&&b.right<=width+1&&b.width>=70,JSON.stringify({width,theme,b}));
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,JSON.stringify({width,theme,a,b}));}
   }
   if(name==='kitchen') {
    const gaps=await page.locator('.kw-item-form').evaluate(el=>[...el.children].slice(1).map((n,i)=>n.getBoundingClientRect().top-el.children[i].getBoundingClientRect().bottom));
    assert.ok(gaps.every(g=>g>=19),JSON.stringify({width,theme,gaps}));
    const margins=await page.locator('.kw-item-form .form-field').evaluateAll(els=>els.map(el=>getComputedStyle(el).marginBottom));
    assert.ok(margins.every(m=>m==='0px'),JSON.stringify({width,theme,margins}));
   }
   if(name==='settings') {
    for(const tab of ['appearance','billing','account','integrations']) {
     await page.locator('[data-settings-tab]').evaluate((el,tab)=>el.dataset.settingsTab=tab,tab);
     const failures=await page.locator('.reference-settings :is(p,h2,h3,strong,small,b,button)').evaluateAll(els=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
      const lum=s=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=s;ctx.fillRect(0,0,1,1);const c=[...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
      return els.filter(el=>el.getClientRects().length&&el.textContent.trim()&&!el.disabled).flatMap(el=>{
       let parent=el,bg='';while(parent){bg=getComputedStyle(parent).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')break;parent=parent.parentElement;}
       const a=lum(getComputedStyle(el).color),b=lum(bg);const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
       return ratio<4.5?[{text:el.textContent.slice(0,70),ratio,bg,color:getComputedStyle(el).color,accent:getComputedStyle(el).getPropertyValue('--color-on-accent'),classes:el.className}]:[];
      });
     });
     assert.deepEqual(failures,[],JSON.stringify({width,theme,tab,failures}));
     if(width===402&&theme==='dark')await page.screenshot({path:`/tmp/famos-settings-${tab}.png`,fullPage:true});
    }
   }
   if(name==='navigation'&&width<768) {
    const nav=page.getByRole('navigation',{name:'Mobile navigation'});
    assert.equal(await nav.getByRole('button').count(),5);
    const boxes=await nav.getByRole('button').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width,height:r.height};}));
    for(const box of boxes)assert.ok(box.width>=44&&box.height>=44&&box.x>=0&&box.right<=width+1,JSON.stringify(box));
   }
   if(name==='shortcutEditor')assert.equal(await page.getByRole('combobox').count(),4);
   if(width===402)await page.screenshot({path:`/tmp/famos-${name}-${theme}.png`,fullPage:true});
  }
 }
 console.log('Actual Settings, Meals and Kitchen DOM: spacing, non-overlap and text contrast passed at four widths in both themes.');
} finally {await browser.close();}
