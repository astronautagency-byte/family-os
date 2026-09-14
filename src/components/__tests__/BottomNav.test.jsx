import { it, expect, vi } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import BottomNav from '../BottomNav';
vi.mock('../../context/FamilyContext', () => ({ useFamily: () => ({ unreadMessageCount: 2 }) }));
it('adds directly to the current feature from the mobile plus', () => {
 const add=vi.fn();
 const {getByRole,queryByRole}=render(<BottomNav active="groceries" onChange={vi.fn()} onAdd={add}/>);
 fireEvent.click(within(getByRole('navigation',{name:'Mobile navigation'})).getByRole('button',{name:'Add grocery item'}));
 expect(add).toHaveBeenCalledWith('groceries');
 expect(queryByRole('dialog')).toBeNull();
});
it('uses direct add actions rather than navigation from the plus menu', () => {
  const add = vi.fn(), change = vi.fn();
  const { getByRole } = render(<BottomNav active="today" onChange={change} onAdd={add}/>);
  fireEvent.click(getByRole('button', { name: 'Open quick actions' }));
  fireEvent.click(within(getByRole('dialog')).getByRole('button', { name: /Add grocery item/ }));
  expect(add).toHaveBeenCalledWith('groceries');
  expect(change).not.toHaveBeenCalled();
});

it('keeps shopping reachable from the mobile More menu', () => {
  const change = vi.fn();
  const { getByRole } = render(<BottomNav active="today" onChange={change}/>);
  fireEvent.click(within(getByRole('navigation', { name: 'Mobile navigation' })).getByRole('button', { name: 'More' }));
  const dialog = getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: /Shopping/ }));
  expect(change).toHaveBeenCalledWith('groceries');
});
it('respects disabled features in quick actions and opens AI through its handler', () => {
  const openAI = vi.fn();
  const { getByRole } = render(<BottomNav active="today" onChange={vi.fn()} onOpenAI={openAI} features={{ meals: false }}/>);
  fireEvent.click(getByRole('button', { name: 'Open quick actions' }));
  const dialog = getByRole('dialog');
  expect(within(dialog).queryByRole('button', { name: /Meals/ })).toBeNull();
  fireEvent.click(within(dialog).getByRole('button', { name: /Ask Fam AI/ }));
  expect(openAI).toHaveBeenCalledOnce();
});
