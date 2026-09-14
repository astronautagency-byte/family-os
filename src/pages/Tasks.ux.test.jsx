import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
import Tasks from './Tasks';
const mocks=vi.hoisted(()=>({add:vi.fn(),remove:vi.fn(),toggle:vi.fn(),tasks:[]}));
vi.mock('../context/FamilyContext',()=>({useFamily:()=>({members:[],memberById:{},tasks:mocks.tasks,taskLists:[],addTask:mocks.add,removeTask:mocks.remove,toggleTask:mocks.toggle,refreshData:vi.fn()})}));
vi.mock('../components/NativeAdBanner',()=>({default:()=>null}));
afterEach(()=>{cleanup();vi.clearAllMocks();mocks.tasks=[];});
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
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'missing'}});
 expect(screen.getByText('No matching tasks')).toBeDefined();
});
it('requires confirmation before deleting a task',()=>{
 mocks.tasks=[{id:'a',title:'Pack lunch',done:false}];
 render(<Tasks/>);
 fireEvent.click(screen.getByRole('button',{name:'Delete Pack lunch'}));
 expect(screen.getByRole('dialog')).toBeDefined();
 expect(mocks.remove).not.toHaveBeenCalled();
});
