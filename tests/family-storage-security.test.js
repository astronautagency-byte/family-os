import test from 'node:test';
import assert from 'node:assert/strict';
import { familyStorageKey, readFamilyStorage, writeFamilyStorage } from '../src/lib/familyStorage.js';

test('private calendar storage is isolated by account and household, without claiming legacy data',()=>{
  const values=new Map(); const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  const base='family-os:calendar-feeds:v1';
  storage.setItem(base,JSON.stringify({events:[{title:'Unowned legacy event'}]}));
  const scope={configured:true,userId:'alice',householdId:'home-one'};
  const alice=familyStorageKey(base,scope),bob=familyStorageKey(base,{...scope,userId:'bob'}),other=familyStorageKey(base,{...scope,householdId:'home-two'});
  assert.equal(readFamilyStorage(storage,alice),null);
  writeFamilyStorage(storage,alice,{events:[{title:'Private appointment'}]});
  assert.equal(readFamilyStorage(storage,bob),null);assert.equal(readFamilyStorage(storage,other),null);
  assert.equal(readFamilyStorage(storage,alice).events[0].title,'Private appointment');
  assert.equal(readFamilyStorage(storage,base).events[0].title,'Unowned legacy event'); // preserved, not reassigned
  const pending=familyStorageKey(base,{configured:true});assert.equal(pending,null);
  writeFamilyStorage(storage,pending,{events:['leak']});assert.equal(values.has(null),false);
  assert.equal(readFamilyStorage(storage,pending),null);
});
