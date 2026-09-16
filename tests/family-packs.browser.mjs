// Export snapshots with FAMOS_PACK_SNAPSHOT=/tmp/famos-pack-snapshots.json npx vitest run src/pages/FamilyPacks.test.jsx
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const snapshots=JSON.parse(readFileSync('/tmp/famos-pack-snapshots.json','utf8'));
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage();
 for(const width of [375,402,768,1280])for(const theme of ['light','dark'])for(const [name,markup] of Object.entries(snapshots)){
  await page.setViewportSize({width,height:900});
  await page.goto('http://127.0.0.1:5173/tests/visual-regression/ux-review.html');
  await page.waitForSelector('.app-content');
  await page.addStyleTag({path:'src/pages/FamilyPacks.css'});
  await page.evaluate(({markup,theme})=>{
   document.documentElement.dataset.famosTheme=theme;document.documentElement.dataset.colorScheme='forest';
   document.body.innerHTML=markup;
  },{markup,theme});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,`${name}/${width}/${theme} overflow`);
  const small=await page.locator('.family-packs button').evaluateAll(els=>els.filter(el=>el.getBoundingClientRect().height<44).map(el=>el.textContent));assert.deepEqual(small,[],`${name} small buttons`);
  const failures=await page.locator('.family-packs :is(p,h1,h2,h3,button,label,a)').evaluateAll(els=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
   const lum=s=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=s;ctx.fillRect(0,0,1,1);const c=[...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
   return els.filter(el=>el.getClientRects().length&&el.textContent.trim()&&!el.disabled).flatMap(el=>{
    let parent=el,bg='';while(parent){bg=getComputedStyle(parent).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')break;parent=parent.parentElement;}
    const a=lum(getComputedStyle(el).color),b=lum(bg);const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    return ratio<4.5?[{text:el.textContent.slice(0,40),ratio,bg,color:getComputedStyle(el).color}]:[];
   });
  });assert.deepEqual(failures,[],`${name}/${width}/${theme} contrast`);
  if(width===402)await page.screenshot({path:`/tmp/famos-pack-${name}-${theme}.png`,fullPage:true});
 }
 console.log('Family Packs: 24 responsive/light/dark checks passed.');
}finally{await browser.close();}
