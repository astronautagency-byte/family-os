import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
import Tasks from './Tasks';
const mocks=vi.hoisted(()=>({add:vi.fn(),remove:vi.fn(),toggle:vi.fn(),tasks:[],members:[]}));
vi.mock('../context/FamilyContext',()=>({useFamily:()=>({members:mocks.members,memberById:Object.fromEntries(mocks.members.map(m=>[m.id,m])),tasks:mocks.tasks,taskLists:[],addTask:mocks.add,removeTask:mocks.remove,toggleTask:mocks.toggle,refreshData:vi.fn()})}));
vi.mock('../components/NativeAdBanner',()=>({default:()=>null}));
afterEach(()=>{cleanup();vi.clearAllMocks();mocks.tasks=[];mocks.members=[];});
it('filters assigned tasks and restores everyone',()=>{
 mocks.members=[{id:'a',name:'Alex'},{id:'b',name:'Katie'}];
 mocks.tasks=[{id:'1',title:'Water plants',done:false,assigneeIds:['a']},{id:'2',title:'Feed cat',done:false,assigneeIds:['b']}];
 render(<Tasks/>);
 fireEvent.click(screen.getByText('Search & filters'));
 fireEvent.change(screen.getByLabelText('Assigned to'),{target:{value:'b'}});
 expect(screen.getByText('Feed cat')).toBeDefined();
 expect(screen.queryByText('Water plants')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Clear filter'}));
 expect(screen.getByText('Water plants')).toBeDefined();
});
it('retains quick-entry text after a failed save',async()=>{
 mocks.add.mockRejectedValue(new Error('Offline — try again'));
 render(<Tasks/>);
 const input=screen.getByLabelText('Add a new task');
 expect(document.activeElement).not.toBe(input);
 fireEvent.change(input,{target:{value:'Pack lunch'}});
 fireEvent.click(screen.getByRole('button',{name:'Add',exact:true}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Offline'));
 expect(input.value).toBe('Pack lunch');
});
it('prevents duplicate submissions while saving',async()=>{
 let resolve;mocks.add.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 render(<Tasks/>);
 fireEvent.change(screen.getByLabelText('Add a new task'),{target:{value:'Water plants'}});
 fireEvent.click(screen.getByRole('button',{name:'Add',exact:true}));
 expect(screen.getByRole('button',{name:'Adding…'}).disabled).toBe(true);
 expect(screen.getByLabelText('Add a new task').disabled).toBe(true);
 await act(async()=>resolve());
 expect(mocks.add).toHaveBeenCalledOnce();
 expect(screen.getByLabelText('Add a new task').value).toBe('');
});
it('makes completed tasks searchable and reopenable',()=>{
 mocks.tasks=[{id:'a',title:'Pack lunch',done:true},{id:'b',title:'Mow lawn',done:false}];
 render(<Tasks/>);
 fireEvent.click(screen.getByRole('button',{name:'Completed',exact:true}));
 expect(screen.getByRole('button',{name:'Reopen Pack lunch'})).toBeDefined();
 expect(screen.queryByRole('button',{name:'Complete Mow lawn'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Reopen Pack lunch'}));
 expect(mocks.toggle).toHaveBeenCalledWith('a');
 fireEvent.click(screen.getByText('Search & filters'));
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'missing'}});
 expect(screen.getByText('No matching tasks')).toBeDefined();
});
it('requires confirmation before deleting a task',()=>{
 window.matchMedia=vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 mocks.tasks=[{id:'a',title:'Pack lunch',done:false}];
 render(<Tasks/>);
 fireEvent.click(screen.getByText('Pack lunch').closest('button'));
 fireEvent.click(screen.getByRole('button',{name:'Delete task',exact:true}));
 expect(screen.getByRole('dialog')).toBeDefined();
 expect(mocks.remove).not.toHaveBeenCalled();
});
it('keeps management and progress collapsed and uses one list selector',()=>{
 mocks.tasks=[{id:'1',title:'Water plants',done:false,taskType:'home'}];render(<Tasks/>);
 expect(screen.getByLabelText('Task list')).toBeDefined();
 expect(screen.getByText('Task options').closest('details').open).toBe(false);
 expect(screen.getByText(/Your family’s progress ·/).closest('details').open).toBe(false);
 fireEvent.click(screen.getByText('Task options'));fireEvent.click(screen.getByRole('button',{name:'Reset tasks'}));expect(screen.getByRole('dialog')).toBeDefined();
});

it('explains named-list sharing and opens Family settings without granting access',()=>{
 const goTo=vi.fn();render(<Tasks goTo={goTo}/>);
 fireEvent.click(screen.getByText('Task options'));
 fireEvent.click(screen.getByRole('button',{name:'Share with helper'}));
 expect(screen.getByText(/Private tasks stay hidden/)).toBeDefined();
 expect(goTo).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Manage helper access'}));
 expect(sessionStorage.getItem('famos:settings-section')).toBe('family');
 expect(goTo).toHaveBeenCalledWith('settings');
 sessionStorage.removeItem('famos:settings-section');
});
