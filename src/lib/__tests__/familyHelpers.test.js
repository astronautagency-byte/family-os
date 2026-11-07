import { afterEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({getSession:vi.fn()}));
vi.mock('../supabase',()=>({supabaseUrl:'https://example.supabase.co',supabaseKey:'public-key',supabase:{auth:{getSession:mocks.getSession}}}));
import { helperCall } from '../familyHelpers';
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals();});
const session=id=>({data:{session:id?{user:{id},access_token:'test-session-token'}:null}});
it('does not deliver a previous account response after an account switch',async()=>{
  mocks.getSession.mockResolvedValueOnce(session('alice')).mockResolvedValueOnce(session('bob'));
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({family:'Private family A'})}));
  await expect(helperCall('read',{id:'one'})).rejects.toThrow('Account changed');
});
it('rejects an in-flight response after sign-out',async()=>{
  mocks.getSession.mockResolvedValueOnce(session('alice')).mockResolvedValueOnce(session(null));
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({family:'Private family A'})}));
  await expect(helperCall('read',{id:'one'})).rejects.toThrow('Account changed');
});
it('uses authenticated uncached requests for the current account',async()=>{
  mocks.getSession.mockResolvedValue(session('alice'));
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({family:'Family A'})});vi.stubGlobal('fetch',fetchMock);
  await expect(helperCall('read',{id:'one'})).resolves.toEqual({family:'Family A'});
  expect(fetchMock).toHaveBeenCalledWith('https://example.supabase.co/rest/v1/rpc/helper_portal',expect.objectContaining({method:'POST',cache:'no-store',headers:expect.objectContaining({Authorization:'Bearer test-session-token'})}));
});
