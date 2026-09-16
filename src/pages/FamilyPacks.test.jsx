import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {writeFileSync} from 'node:fs';
import FamilyPacks from './FamilyPacks';
const state=vi.hoisted(()=>({auth:{},features:{},tables:{},rpc:vi.fn()}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>state.auth}));
vi.mock('../context/HouseholdFeaturesContext',()=>({useHouseholdFeatures:()=>({features:state.features,loading:false})}));
vi.mock('../lib/supabase',()=>({supabase:{rpc:(...args)=>state.rpc(...args),from:table=>{
 const query={};for(const method of ['select','eq','order','gte','lte','limit'])query[method]=()=>query;
 query.then=(...args)=>Promise.resolve({data:state.tables[table]||[],error:null}).then(...args);return query;
}}}));
const token='a'.repeat(64);
const pack={kind:'tasks',title:'Weekly reset',items:[{title:'Wash dishes'}]};
beforeEach(()=>{window.matchMedia=vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));window.history.replaceState({},'','/packs');state.auth={user:{id:'parent'},household:{id:'home',role:'owner'}};state.features={};state.tables={tasks:[{id:'1',title:'Wash dishes',notes:'Secret',assignee_id:'child'}]};state.rpc.mockReset();});
afterEach(cleanup);
async function review(){await screen.findByText('Wash dishes');fireEvent.change(screen.getByLabelText('Pack name'),{target:{value:'Weekly reset'}});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:/Review 1/}));}
it('requires a privacy review, strips private data and confirms successful publication',async()=>{
 state.rpc.mockResolvedValue({data:token,error:null});render(<FamilyPacks/>);await review();
 const publish=screen.getByRole('button',{name:'Create private share link'});expect(publish).toBeDisabled();expect(screen.queryByText('Secret')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(publish);await screen.findByText('Your pack is ready to share.');
 expect(state.rpc).toHaveBeenCalledWith('publish_family_pack',{h:'home',p:{...pack,version:1}});
 expect(screen.getByLabelText('Share link').value).toContain(`/packs#${token}`);
});
it('editing after consent requires a fresh review and publishing errors preserve the draft',async()=>{
 state.rpc.mockResolvedValue({data:null,error:{message:'Please retry'}});render(<FamilyPacks/>);await review();fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.change(screen.getByLabelText('Item name'),{target:{value:'Clean dishes'}});expect(screen.getByRole('button',{name:'Create private share link'})).toBeDisabled();
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Create private share link'}));await screen.findByRole('alert');expect(screen.getByLabelText('Item name')).toHaveValue('Clean dishes');
});
it('anonymous recipients can preview without signing in or loading household data',async()=>{
 window.history.replaceState({},'',`/packs#${token}`);state.auth={};state.rpc.mockResolvedValue({data:pack,error:null});render(<FamilyPacks/>);
 await screen.findByText('Wash dishes');expect(screen.getByRole('button',{name:/Sign in to use/})).toBeInTheDocument();expect(screen.queryByText('Make a Family Pack')).not.toBeInTheDocument();
});
it('imports only on explicit click and confirms a server-confirmed copy',async()=>{
 window.history.replaceState({},'',`/packs#${token}`);state.rpc.mockImplementation(name=>Promise.resolve({data:name==='preview_family_pack'?pack:{count:1},error:null}));render(<FamilyPacks/>);
 fireEvent.click(await screen.findByRole('button',{name:'Use this with my family'}));await screen.findByText(/Your copy is ready/);expect(state.rpc).toHaveBeenCalledWith('import_family_pack',{t:token,h:'home',start_date:null});
});
it('unavailable links do not offer import',async()=>{
 window.history.replaceState({},'',`/packs#${token}`);state.rpc.mockResolvedValue({data:null,error:null});render(<FamilyPacks/>);expect(await screen.findByRole('alert')).toHaveTextContent('expired or was revoked');expect(screen.queryByRole('button',{name:'Use this with my family'})).not.toBeInTheDocument();
});
it('meal import sends an explicit date and keeps the preview after a conflict',async()=>{
 window.history.replaceState({},'',`/packs#${token}`);state.rpc.mockImplementation(name=>Promise.resolve(name==='preview_family_pack'?{data:{kind:'meals',title:'Weeknight meals',items:[{title:'Pasta',day:0,slot:'dinner'}]}}:{error:{message:'A meal already exists. Nothing was imported.'}}));render(<FamilyPacks/>);
 const button=await screen.findByRole('button',{name:'Use this with my family'});expect(state.rpc).toHaveBeenCalledTimes(1);fireEvent.click(button);
 await screen.findByRole('alert');expect(screen.getByText('Pasta')).toBeInTheDocument();expect(screen.queryByText(/Your copy is ready/)).not.toBeInTheDocument();expect(state.rpc.mock.calls[1][1].start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
it('non-owners and disabled features cannot import through the UI',async()=>{
 window.history.replaceState({},'',`/packs#${token}`);state.auth.household.role='member';state.rpc.mockResolvedValue({data:pack,error:null});render(<FamilyPacks/>);await screen.findByText('Ask your household owner to import this pack.');cleanup();
 state.auth.household.role='owner';state.features={tasks:false};render(<FamilyPacks/>);await screen.findByText(/This page is turned off/);expect(screen.queryByRole('button',{name:'Use this with my family'})).not.toBeInTheDocument();
});
it('exports real component states for mobile and dark-mode browser checks',async()=>{
 const snapshots={};render(<FamilyPacks/>);await screen.findByText('Wash dishes');snapshots.composer=document.body.innerHTML;
 await review();snapshots.review=document.body.innerHTML;cleanup();
 window.history.replaceState({},'',`/packs#${token}`);state.auth={};state.rpc.mockResolvedValue({data:{kind:'recipes',title:'Weeknight favourite',items:[{title:'Easy tomato pasta',recipe:{ingredients:['200 g pasta','2 ripe tomatoes'],instructions:['Boil pasta.','Simmer tomatoes and combine.'],sourceUrl:'https://example.com/pasta',sourceName:'Original cook',servings:4,readyInMinutes:20}}]},error:null});
 render(<FamilyPacks/>);await screen.findByText('Easy tomato pasta');snapshots.preview=document.body.innerHTML;
 if(process.env.FAMOS_PACK_SNAPSHOT)writeFileSync(process.env.FAMOS_PACK_SNAPSHOT,JSON.stringify(snapshots));
});
