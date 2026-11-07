import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import HelperResources from './HelperResources';
afterEach(cleanup);
it('shows school and soccer events as a read-only schedule without completion controls',()=>{
 const now=new Date();const start=new Date(now.getTime()+3600000).toISOString(),end=new Date(now.getTime()+7200000).toISOString();
 render(<HelperResources expiry={new Date(now.getTime()+86400000).toISOString()} resources={[{grant_id:'c',kind:'calendar',name:'School & soccer',permission:'view',items:[{id:'game',title:'Soccer game',start,end}]}]} onComplete={vi.fn()}/>);
 expect(screen.getByRole('heading',{name:'Schedules'})).toBeDefined();expect(screen.getByText('Soccer game')).toBeDefined();expect(screen.getByText('Shared schedule · View only')).toBeDefined();expect(screen.queryByRole('checkbox')).toBeNull();
});
it('shows today’s routine instructions and checks only the selected occurrence',()=>{
 const complete=vi.fn(),resource={grant_id:'r',kind:'tasks',name:'Morning routine',permission:'complete',routine_cadence:'daily',routine_day:'2026-11-07',items:[{id:'today',title:'Pack bags',notes:'Include soccer kit',done:false}]};
 render(<HelperResources expiry="2026-12-07" resources={[resource]} onComplete={complete}/>);
 expect(screen.getByText(/Completed tasks return on the next scheduled day/)).toBeDefined();expect(screen.getByText('Include soccer kit')).toBeDefined();fireEvent.click(screen.getByRole('checkbox'));expect(complete).toHaveBeenCalledWith(resource,resource.items[0]);
});
it('keeps view-only routines as instructions with no implied checkbox action',()=>{
 render(<HelperResources expiry="2026-12-07" resources={[{grant_id:'r',kind:'tasks',name:'House guide',permission:'view',routine_cadence:'daily',routine_day:'2026-11-07',items:[{id:'a',title:'School pickup instructions',done:false}]}]} onComplete={vi.fn()}/>);expect(screen.queryByRole('checkbox')).toBeNull();expect(screen.getByText(/View instructions/)).toBeDefined();
});
it('separates schedules from routine checklists when both are shared',()=>{
 const now=Date.now();const resources=[{grant_id:'c',kind:'calendar',name:'School',permission:'view',items:[{id:'event',title:'School concert',start:new Date(now+3600000).toISOString(),end:new Date(now+7200000).toISOString()}]},{grant_id:'r',kind:'tasks',name:'Daily care',permission:'complete',routine_cadence:'daily',routine_day:'2026-11-07',items:[{id:'a',title:'Prepare lunch',done:false}]}];
 render(<HelperResources resources={resources} expiry={new Date(now+86400000).toISOString()} onComplete={vi.fn()}/>);
 expect(screen.getByRole('checkbox')).toBeDefined();expect(screen.queryByText('School concert')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Schedules'}));expect(screen.getByText('School concert')).toBeDefined();expect(screen.queryByRole('checkbox')).toBeNull();
});
