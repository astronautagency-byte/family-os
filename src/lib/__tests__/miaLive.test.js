import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../supabase',()=>({supabaseUrl:'https://example.supabase.co'}));
import {createMiaLive} from '../miaLive';

afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
function setup(){
 const track={stop:vi.fn()},node=()=>({connect:vi.fn(),disconnect:vi.fn()});
 const ctx={resume:vi.fn().mockResolvedValue(),close:vi.fn().mockResolvedValue(),audioWorklet:{addModule:vi.fn().mockResolvedValue()},createMediaStreamSource:vi.fn(node),createGain:()=>({...node(),gain:{value:1}}),currentTime:0};
 window.AudioContext=class{constructor(){return ctx;}};
 vi.stubGlobal('AudioWorkletNode',class{constructor(){Object.assign(this,node(),{port:{}});}});
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[track]})}});
 const sockets=[];
 vi.stubGlobal('WebSocket',class{static OPEN=1;constructor(url){this.url=url;this.readyState=1;this.send=vi.fn();this.close=vi.fn();sockets.push(this);}});
 const callbacks={onState:vi.fn(),onUserText:vi.fn(),onAssistantText:vi.fn(),onProposal:vi.fn().mockResolvedValue({review:true}),onError:vi.fn()};
 return {track,ctx,sockets,callbacks,live:createMiaLive(callbacks)};
}
async function connect(f){const pending=f.live.start('token');await vi.waitFor(()=>expect(f.sockets).toHaveLength(1));const ws=f.sockets[0];ws.onopen();await ws.onmessage({data:JSON.stringify({type:'mia.ready'})});await pending;return ws;}
it('keeps credentials out of the URL and releases mic, socket and audio on stop',async()=>{
 const f=setup(),ws=await connect(f);
 expect(ws.url).toBe('wss://example.supabase.co/functions/v1/mia-live');
 expect(JSON.parse(ws.send.mock.calls[0][0])).toMatchObject({type:'auth',token:'token'});
 expect(f.live.connected).toBe(true);f.live.stop();f.live.stop();
 expect(f.track.stop).toHaveBeenCalledTimes(1);expect(ws.close).toHaveBeenCalledTimes(1);expect(f.ctx.close).toHaveBeenCalledTimes(1);expect(f.live.connected).toBe(false);
});
it('stops a delayed microphone acquisition after the panel closes',async()=>{
 const f=setup();let grant;
 navigator.mediaDevices.getUserMedia.mockImplementation(()=>new Promise(resolve=>grant=resolve));
 const pending=f.live.start('token');await vi.waitFor(()=>expect(grant).toBeTypeOf('function'));
 f.live.stop();grant({getTracks:()=>[f.track]});await pending;
 expect(f.track.stop).toHaveBeenCalledTimes(1);expect(f.sockets).toHaveLength(0);
});
it('exits connecting if device audio initialization never resolves',async()=>{
 vi.useFakeTimers();const f=setup();f.ctx.resume.mockImplementation(()=>new Promise(()=>{}));
 f.live.start('token');await vi.advanceTimersByTimeAsync(25001);
 expect(f.callbacks.onError).toHaveBeenCalledWith('Live voice could not connect. Please try again.');
 expect(f.ctx.close).toHaveBeenCalledTimes(1);expect(f.sockets).toHaveLength(0);
});
it('deduplicates transcripts and proposals and stops on a server error',async()=>{
 const f=setup(),ws=await connect(f);
 const emit=event=>ws.onmessage({data:JSON.stringify(event)});
 for(let i=0;i<2;i++)await emit({type:'conversation.item.input_audio_transcription.completed',item_id:'u1',transcript:'add lemons'});
 for(let i=0;i<2;i++)await emit({type:'response.function_call_arguments.done',name:'prepare_addition',call_id:'c1',arguments:'{"type":"add_grocery","args":{"name":"lemons"}}'});
 expect(f.callbacks.onUserText).toHaveBeenCalledTimes(1);expect(f.callbacks.onProposal).toHaveBeenCalledTimes(1);
 await emit({type:'mia.error',message:'Consent withdrawn'});
 expect(f.track.stop).toHaveBeenCalledTimes(1);expect(f.callbacks.onError).toHaveBeenCalledWith('Consent withdrawn');
});
