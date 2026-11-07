import test from 'node:test';import assert from 'node:assert/strict';
import {validateSpeechText,synthesizeMiaSpeech} from '../supabase/functions/_shared/miaSpeech.js';
import {chooseMiaVoice,unlockMiaAudio} from '../src/lib/miaVoice.js';
test('speech validates a short reply and uses fixed natural voice settings',async()=>{
 assert.throws(()=>validateSpeechText('x'.repeat(601)));assert.throws(()=>validateSpeechText(''));assert.equal(validateSpeechText('[whisper] Hello'),'whisper Hello');
 let request;
 const result=await synthesizeMiaSpeech({text:'What day is your haircut?',groqKey:'test',fetchImpl:async(url,options)=>{request={url,...options};return new Response(new Uint8Array(200),{headers:{'content-type':'audio/wav'}});}});
 assert.equal(result.mime,'audio/wav');assert.equal(JSON.parse(request.body).voice,'autumn');assert.equal(JSON.parse(request.body).input,'What day is your haircut?');
});
test('provider errors fall back without exposing provider error bodies',async()=>{
 let count=0;const result=await synthesizeMiaSpeech({text:'Hello',groqKey:'one',xaiKey:'two',fetchImpl:async()=>++count===1?new Response('private provider details',{status:403}):new Response(new Uint8Array(200))});assert.equal(result.provider,'xai');assert.equal(count,2);
 await assert.rejects(synthesizeMiaSpeech({text:'Hello',groqKey:'one',fetchImpl:async()=>new Response('secret',{status:401})}),/temporarily unavailable/);
});
test('prefers enhanced natural voices over the default and excludes novelty voices',()=>{
 const enhanced={name:'Samantha (Enhanced)',lang:'en-US'};assert.equal(chooseMiaVoice([{name:'Fred',lang:'en-US',default:true},enhanced,{name:'Zarvox (Premium)',lang:'en-US'}]),enhanced);assert.equal(chooseMiaVoice([]),null);
});

test('mobile audio unlock uses a decodable nonempty silent WAV',async()=>{
 const audio={play:()=>Promise.resolve(),pause:()=>{}};
 assert.equal(unlockMiaAudio(audio),audio);
 const bytes=Buffer.from(audio.src.split(',')[1],'base64');
 assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');assert.ok(bytes.readUInt32LE(40)>0);assert.equal(bytes.readUInt32LE(4)+8,bytes.length);
});
