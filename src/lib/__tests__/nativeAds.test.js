import {expect,it,vi} from 'vitest';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('../supabase',()=>({supabase:{rpc}}));
vi.mock('../distribution',()=>({IS_APP_STORE:true}));
import {fetchAdsForPlacement,trackAdImpression} from '../adNetwork';
it('keeps all native accounts equally ad-free without collecting ad impressions',async()=>{
 expect(await fetchAdsForPlacement('calendar')).toEqual({paid:false,ads:[]});
 await trackAdImpression('campaign','calendar',true);
 expect(rpc).not.toHaveBeenCalled();
});
