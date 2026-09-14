// Requires the local Vite server; no recipe is uploaded to an external service.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:5173/tests/visual-regression/ux-review.html');
 const result=await page.evaluate(async()=>{
  const {readRecipePhotos}=await import('/src/lib/recipeImport.js');
  const canvas=document.createElement('canvas');canvas.width=2200;canvas.height=1800;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(canvas.width,canvas.height);
  for(let i=0;i<pixels.data.length;i+=4){const n=200+Math.floor(Math.random()*55);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=n;pixels.data[i+3]=255;}
  ctx.putImageData(pixels,0,0);ctx.fillStyle='black';ctx.font='60px sans-serif';
  ctx.fillText('Pancakes: 1 cup flour, 1 egg, 1 cup milk',80,180);
  ctx.fillText('Mix ingredients. Cook in a hot pan.',80,280);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  const file=new File([blob],'recipe.png',{type:'image/png'});
  const photos=await readRecipePhotos([file]);
  return {originalBytes:file.size,preparedCharacters:photos[0].length,jpeg:photos[0].startsWith('data:image/jpeg;base64,')};
 });
 assert.ok(result.originalBytes>1000000);
 assert.ok(result.preparedCharacters<=1300000);
 assert.ok(result.jpeg);
 console.log('Real browser photo compression passed:',result);
}finally{await browser.close();}
