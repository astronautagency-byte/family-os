import test from 'node:test';
import assert from 'node:assert/strict';
import {ALL_MARKETING_PAGES,MARKETING_PAGES,marketingPageForPath} from '../src/data/marketingPages.js';
import {readFileSync} from 'node:fs';
test('each public topic has a unique canonical route, title and useful content',()=>{
 for(const field of ['path','title','description']) assert.equal(new Set(ALL_MARKETING_PAGES.map(p=>p[field])).size,ALL_MARKETING_PAGES.length);
 for(const p of ALL_MARKETING_PAGES){
  assert.ok(p.sections.length>=3);assert.equal(p.steps.length,3);assert.ok(p.faqs.length>=2);
  assert.ok(p.sections.every(([h,body])=>h.length>10&&body.length>100));
  assert.equal(marketingPageForPath(p.path+'/'),p);
  for(const id of p.related) assert.ok(ALL_MARKETING_PAGES.some(q=>q.id===id),`${p.id} has broken related link ${id}`);
 }
 assert.equal(MARKETING_PAGES.length,12);
});
test('all canonical routes have static rewrites and legacy aliases redirect once',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
 for(const p of ALL_MARKETING_PAGES) assert.ok(config.rewrites.some(r=>r.source===p.path&&r.destination===`/__public${p.path}.html`));
 assert.equal(config.redirects.find(r=>r.source==='/meal-planning').destination,'/features/meals');
});
