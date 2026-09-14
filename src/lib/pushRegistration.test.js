import {it,expect,vi,afterEach} from 'vitest';
import {registerPushDevice} from './pushRegistration';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
function setup({error=null,ready}={}){
 const subscription={endpoint:'https://push.example/device',toJSON:()=>({endpoint:'https://push.example/device'})};
 const subscribe=vi.fn().mockResolvedValue(subscription);
 vi.stubGlobal('PushManager',function(){});
 vi.stubGlobal('navigator',{platform:'test',serviceWorker:{ready:ready || Promise.resolve({pushManager:{getSubscription:async()=>null,subscribe}})}});
 const upsert=vi.fn().mockResolvedValue({error});
 return {client:{from:()=>({upsert})},upsert,subscribe};
}
it('registers the current device for the authenticated user',async()=>{
 const {client,upsert}=setup();
 expect(await registerPushDevice({client,userId:'alex',publicKey:new Uint8Array()})).toBe('https://push.example/device');
 expect(upsert.mock.calls[0][0].user_id).toBe('alex');
});
it('surfaces registration failures instead of claiming success',async()=>{
 const {client}=setup({error:Error('Registration refused')});
 await expect(registerPushDevice({client,userId:'alex'})).rejects.toThrow('Registration refused');
});
it('does not hang forever waiting for a service worker',async()=>{
 vi.useFakeTimers();const {client}=setup({ready:new Promise(()=>{})});
 const result=expect(registerPushDevice({client,userId:'alex',timeoutMs:100})).rejects.toThrow('not ready');
 await vi.advanceTimersByTimeAsync(100);await result;
});
it('requires a signed-in user',async()=>{
 const {client}=setup();await expect(registerPushDevice({client})).rejects.toThrow('Sign in');
});
