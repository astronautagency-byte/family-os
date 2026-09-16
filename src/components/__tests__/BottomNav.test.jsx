import { it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import BottomNav from '../BottomNav';
vi.mock('../../context/FamilyContext', () => ({ useFamily: () => ({ unreadMessageCount: 2 }) }));
beforeEach(()=>localStorage.clear());
it('removes disabled destinations from child navigation',()=>{
 const {getByRole}=render(<BottomNav childMode active="chat" onChange={vi.fn()} features={{calendar:false,tasks:false,rewards:false}}/>);
 expect(within(getByRole('navigation',{name:'Mobile navigation'})).getAllByRole('button').map(b=>b.textContent)).toEqual(['Chat (2)','More']);
});
it('gives children only permitted destinations and a restricted customization menu',()=>{
 const change=vi.fn();
 const {getByRole}=render(<BottomNav childMode active="tasks" onChange={change}/>);
 const mobile=within(getByRole('navigation',{name:'Mobile navigation'}));
 expect(mobile.getAllByRole('button').map(b=>b.textContent)).toEqual(['Calendar','Tasks','Rewards','Chat (2)','More']);
 const desktop=within(getByRole('navigation',{name:'FamOS navigation'}));
 expect(desktop.getAllByRole('button')).toHaveLength(4);
 fireEvent.click(mobile.getByRole('button',{name:'Rewards'}));
 expect(change).toHaveBeenCalledWith('rewards');
});
it.each(['today','calendar','tasks','groceries','kitchen','meals'])('keeps %s navigation free of redundant add controls', (active) => {
 const {getByRole,queryByRole}=render(<BottomNav active={active} onChange={vi.fn()}/>);
 const mobile=getByRole('navigation',{name:'Mobile navigation'});
 expect(within(mobile).getAllByRole('button').map(b=>b.textContent)).toEqual(['Home','Calendar','Tasks','Chat (2)','More']);
 expect(mobile.style.gridTemplateColumns).toBe('repeat(5,minmax(0,1fr))');
 expect(queryByRole('button',{name:'Open quick actions'})).toBeNull();
 expect(mobile.querySelector('.reference-add-button')).toBeNull();
});
it('saves ordered shortcuts per profile and keeps replaced pages reachable',()=>{
 const props={active:'today',onChange:vi.fn(),preferenceKey:'alex:home'};
 const view=render(<BottomNav {...props}/>);
 const mobile=()=>within(view.getByRole('navigation',{name:'Mobile navigation'}));
 fireEvent.click(mobile().getByRole('button',{name:'More'}));
 fireEvent.click(view.getByRole('button',{name:/Customize shortcuts/}));
 fireEvent.change(view.getByRole('combobox',{name:'Shortcut 1'}),{target:{value:'groceries'}});
 fireEvent.click(view.getByRole('button',{name:'Save shortcuts'}));
 expect(mobile().getAllByRole('button').map(b=>b.textContent)).toEqual(['Shopping','Calendar','Tasks','Chat (2)','More']);
 view.unmount();
 const again=render(<BottomNav {...props}/>);
 expect(within(again.getByRole('navigation',{name:'Mobile navigation'})).getByRole('button',{name:'Shopping'})).toBeDefined();
 fireEvent.click(within(again.getByRole('navigation',{name:'Mobile navigation'})).getByRole('button',{name:'More'}));
 expect(within(again.getByRole('dialog')).getByRole('button',{name:/Today/})).toBeDefined();
 again.rerender(<BottomNav {...props} preferenceKey="kat:home"/>);
 expect(within(again.getByRole('navigation',{name:'Mobile navigation'})).getByRole('button',{name:'Home'})).toBeDefined();
});
it('never exposes adult pages through child customization',()=>{
 const view=render(<BottomNav childMode active="calendar" onChange={vi.fn()} onOpenAI={vi.fn()}/>);
 fireEvent.click(within(view.getByRole('navigation',{name:'Mobile navigation'})).getByRole('button',{name:'More'}));
 const dialog=within(view.getByRole('dialog'));
 expect(dialog.queryByRole('button',{name:/Settings & family|Ask Fam AI/})).toBeNull();
 fireEvent.click(dialog.getByRole('button',{name:/Customize shortcuts/}));
 expect(within(view.getByRole('combobox',{name:'Shortcut 1'})).getAllByRole('option').map(o=>o.value)).toEqual(['calendar','rewards','tasks','chat']);
 fireEvent.change(view.getByRole('combobox',{name:'Shortcut 1'}),{target:{value:'chat'}});
 expect(view.getByRole('combobox',{name:'Shortcut 4'}).value).toBe('calendar');
});
it('keeps shopping reachable from the mobile More menu', () => {
  const change = vi.fn();
  const { getByRole } = render(<BottomNav active="today" onChange={change}/>);
  fireEvent.click(within(getByRole('navigation', { name: 'Mobile navigation' })).getByRole('button', { name: 'More' }));
  const dialog = getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: /Shopping/ }));
  expect(change).toHaveBeenCalledWith('groceries');
});
it('respects disabled features in More and opens AI through its handler', () => {
  const openAI = vi.fn();
  const { getByRole } = render(<BottomNav active="today" onChange={vi.fn()} onOpenAI={openAI} features={{ meals: false }}/>);
  fireEvent.click(within(getByRole('navigation', { name: 'Mobile navigation' })).getByRole('button', { name: 'More' }));
  const dialog = getByRole('dialog');
  expect(within(dialog).queryByRole('button', { name: /Meals/ })).toBeNull();
  fireEvent.click(within(dialog).getByRole('button', { name: /Ask Fam AI/ }));
  expect(openAI).toHaveBeenCalledOnce();
});
