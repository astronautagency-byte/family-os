import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanPack,packCandidates,publicSource} from '../src/lib/familyPacks.js';
test('task packs whitelist content, excluding household identity, dates, assignments and notes',()=>{
 assert.deepEqual(cleanPack({kind:'tasks',title:'Weekly reset',household_id:'secret',items:[{id:'secret',title:'Tidy kitchen',assignee:'Katie',due_date:'2026-09-16',notes:'Home address',points:9,done:true}]}),{version:1,kind:'tasks',title:'Weekly reset',items:[{title:'Tidy kitchen'}]});
});
test('recipe packs retain attribution but no uploaded images, private notes or unknown fields',()=>{
 const pack=cleanPack({kind:'recipes',title:'Dinner',items:[{title:'Pasta',recipe:{ingredients:['100g pasta'],instructions:['Boil pasta'],sourceUrl:'https://example.com/pasta',sourceName:'Chef',sourcePhotos:['private'],thumbnail:'private',notes:'allergy',servings:4}}]});
 assert.equal(pack.items[0].recipe.sourceUrl,'https://example.com/pasta');
 for(const field of ['sourcePhotos','thumbnail','notes'])assert.equal(field in pack.items[0].recipe,false);
});
test('bearer URLs, credentials, and non-HTTPS links are not published',()=>{
 for(const url of ['javascript:alert(1)','https://user:pass@example.com/a','https://example.com/a?token=secret','https://example.com/a#secret','http://example.com'])assert.equal(publicSource(url),'');
});
test('invalid packs, incomplete recipes and unsupported schedules are rejected',()=>{
 for(const pack of [{kind:'bad',title:'x',items:[]},{kind:'tasks',title:'',items:[{title:'x'}]},{kind:'tasks',title:'x',items:[]},{kind:'recipes',title:'x',items:[{title:'x',recipe:{}}]},{kind:'routines',title:'x',items:[{title:'x',cadence:'hourly'}]}])assert.throws(()=>cleanPack(pack));
});
test('routine selection excludes private notes and only accepts supported recurrences',()=>{
 assert.deepEqual(packCandidates('routines',[{id:'1',title:'Reset',recurrence:'routine:weekly',notes:'private'},{id:'2',title:'Other',recurrence:''}]),[{id:'1',title:'Reset',cadence:'weekly',steps:[]}]);
});
test('meal dates become relative days with no cooks or private notes',()=>{
 const rows=packCandidates('meals',[{id:'1',title:'Pasta',meal_date:'2026-09-16',slot:'dinner',cook_ids:['a']},{id:'2',title:'Soup',meal_date:'2026-09-18',slot:'lunch'}]);
 assert.deepEqual(rows.map(r=>r.day),[0,2]);
 const pack=cleanPack({kind:'meals',title:'Two meals',items:rows});
 assert.equal(pack.items[0].meal_date,undefined);assert.equal(pack.items[0].id,undefined);assert.equal(pack.items[0].cook_ids,undefined);
});
