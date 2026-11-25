import {afterEach, expect, it, vi} from 'vitest';
afterEach(()=>{vi.restoreAllMocks();vi.resetModules();vi.doUnmock('./distribution');});
it('does not register update or reload handlers in a native distribution', async()=>{
 vi.doMock('./distribution',()=>({IS_APP_STORE:true}));
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:vi.fn()}});
 const listen=vi.spyOn(window,'addEventListener');
 const {setupSelfUpdate}=await import('./selfUpdate');
 setupSelfUpdate();
 expect(listen).not.toHaveBeenCalled();
});
it('retains update checks for the browser distribution', async()=>{
 vi.doMock('./distribution',()=>({IS_APP_STORE:false}));
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:vi.fn()}});
 const listen=vi.spyOn(window,'addEventListener');
 const {setupSelfUpdate}=await import('./selfUpdate');
 setupSelfUpdate();
 expect(listen).toHaveBeenCalledWith('focus',expect.any(Function));
});
