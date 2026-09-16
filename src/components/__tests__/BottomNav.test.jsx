import { it, expect, vi } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import BottomNav from '../BottomNav';
vi.mock('../../context/FamilyContext', () => ({ useFamily: () => ({ unreadMessageCount: 2 }) }));
it('removes disabled destinations from child navigation',()=>{
 const {getByRole}=render(<BottomNav childMode active="chat" onChange={vi.fn()} features={{calendar:false,tasks:false,rewards:false}}/>);
 expect(within(getByRole('navigation',{name:'Mobile navigation'})).getAllByRole('button').map(b=>b.textContent)).toEqual(['Chat']);
});
it('gives children only four destinations and no global add or More menu',()=>{
 const change=vi.fn();
 const {getByRole}=render(<BottomNav childMode active="tasks" onChange={change}/>);
 const mobile=within(getByRole('navigation',{name:'Mobile navigation'}));
 expect(mobile.getAllByRole('button').map(b=>b.textContent)).toEqual(['Calendar','Tasks','Rewards','Chat']);
 const desktop=within(getByRole('navigation',{name:'FamOS navigation'}));
 expect(desktop.getAllByRole('button')).toHaveLength(4);
 fireEvent.click(mobile.getByRole('button',{name:'Rewards'}));
 expect(change).toHaveBeenCalledWith('rewards');
});
it.each(['today','calendar','tasks','groceries','kitchen','meals'])('keeps %s navigation free of redundant add controls', (active) => {
 const {getByRole,queryByRole}=render(<BottomNav active={active} onChange={vi.fn()}/>);
 const mobile=getByRole('navigation',{name:'Mobile navigation'});
 expect(within(mobile).getAllByRole('button').map(b=>b.textContent)).toEqual(['Home','Calendar','Chat (2)','More']);
 expect(mobile.style.gridTemplateColumns).toBe('repeat(4,minmax(0,1fr))');
 expect(queryByRole('button',{name:'Open quick actions'})).toBeNull();
 expect(mobile.querySelector('.reference-add-button')).toBeNull();
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
