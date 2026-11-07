import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const merge=require('deepmerge');
test('build merge cannot poison target or source prototypes',()=>{
 const payload=JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"safe":{"value":2}}');
 for(const [a,b] of [[payload,{}],[{},payload],[Object.create(null),payload],[{nested:payload},{}],[{}, {nested:payload}]]){
  const result=merge(a,b);
  assert.equal(result.polluted,undefined);
  assert.equal(result.nested?.polluted,undefined);
  assert.equal(Object.hasOwn(result,'__proto__'),false);
  assert.equal(Object.hasOwn(result,'constructor'),false);
 }
 assert.deepEqual(merge({safe:{a:1}},{safe:{b:2}}),{safe:{a:1,b:2}});
 assert.equal({}.polluted,undefined);
});
