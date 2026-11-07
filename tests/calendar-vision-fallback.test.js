import test from 'node:test';
import assert from 'node:assert/strict';
import { readCalendarVision, calendarVisionError } from '../supabase/functions/_shared/calendarVision.js';

const providers = [{url:'https://primary.invalid',key:'primary',model:'vision-one'},{url:'https://backup.invalid',key:'backup',model:'vision-two'}];
const success = events => new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({events})}}]}), {status:200});

test('uses the backup after a primary network failure without exposing request content', async () => {
  const calls=[];
  const fetchImpl=async (url, options)=>{calls.push({url,options});if(calls.length===1)throw Error('private photo contents');return success([{title:'Game'}]);};
  const outcome=await readCalendarVision({providers,messages:[{role:'user',content:'private'}],fetchImpl});
  assert.deepEqual(outcome.result.events,[{title:'Game'}]);
  assert.deepEqual(calls.map(call=>call.url),['https://primary.invalid','https://backup.invalid']);
});
test('uses the backup when the primary returns unusable JSON', async () => {
  let calls=0;
  const outcome=await readCalendarVision({providers,messages:[],fetchImpl:async()=>++calls===1?new Response('{"choices":[]}',{status:200}):success([])});
  assert.deepEqual(outcome.result.events,[]);
  assert.equal(calls,2);
});
test('returns a safe actionable error if all providers fail', async () => {
  const outcome=await readCalendarVision({providers,messages:[],fetchImpl:async()=>new Response('billing error with private details',{status:402})});
  assert.deepEqual(outcome.failure,{status:402,reason:'billing'});
  assert.match(calendarVisionError(outcome.failure),/provider account updated/i);
  assert.doesNotMatch(calendarVisionError(outcome.failure),/private details/);
});
