import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const worker=readFileSync(new URL('../public/notification-sw.js',import.meta.url),'utf8');
async function notificationFor(payload){const handlers={};let result,pending;const self={location:{origin:'https://home.fam-os.app'},addEventListener:(name,handler)=>{handlers[name]=handler},registration:{showNotification:async(title,options)=>{result={title,...options}}}};vm.runInNewContext(worker,{self,URL,console});handlers.push({data:{json:()=>payload},waitUntil:p=>{pending=p}});await pending;return result;}
test('silent voice-note alerts keep their visible content and link without requesting a repeat sound',async()=>{const n=await notificationFor({title:'Family voice note',body:'Voice note',tag:'broadcast-1',url:'/#today',silent:true});assert.equal(n.silent,true);assert.equal(n.renotify,false);assert.equal(n.title,'Family voice note');assert.equal(n.body,'Voice note');assert.equal(n.data.url,'https://home.fam-os.app/#today');});
test('ordinary household notifications keep normal alert behavior',async()=>{const n=await notificationFor({title:'Calendar updated',url:'/#calendar'});assert.equal(Object.hasOwn(n,'silent'),false);assert.equal(n.renotify,true);});
