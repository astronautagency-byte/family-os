import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInstacartList,validInstacartLink} from '../supabase/functions/_shared/instacartShopping.js';
test('hands off only grocery names and supported quantities',()=>{const result=buildInstacartList([{name:'  Apples  ',quantity:3,unit:'each',notes:'private',householdId:'private'},{name:'Milk',quantity:2,unit:'mystery'}]);assert.deepEqual(result.line_items,[{name:'Apples',line_item_measurements:[{quantity:3,unit:'each'}]},{name:'Milk'}]);assert.equal(JSON.stringify(result).includes('private'),false)});
test('rejects empty or oversized lists and untrusted links',()=>{assert.throws(()=>buildInstacartList([]));assert.throws(()=>buildInstacartList(Array(101).fill({name:'x'})));assert.equal(validInstacartLink('https://www.instacart.com/store/shopping_lists/123'),true);assert.equal(validInstacartLink('https://instacart.com.evil.test/'),false);assert.equal(validInstacartLink('javascript:alert(1)'),false)});
