import { it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import CompletionScreen from '../CompletionScreen';
import ReferenceAgenda from '../ReferenceAgenda';
vi.mock('../../lib/brandConfetti',()=>({launchBrandConfetti:vi.fn(),resetBrandConfetti:vi.fn()}));
afterEach(cleanup);
it('shows a persistent, keyboard-dismissible task celebration', () => {
  const close = vi.fn();
  const {getByRole} = render(<CompletionScreen onClose={close}/>);
  expect(getByRole('dialog').textContent).toContain('Task Completed!');
  expect(document.activeElement).toBe(getByRole('button', {name:'Awesome!'}));
  fireEvent.keyDown(getByRole('dialog'), {key:'Escape'});
  expect(close).toHaveBeenCalledOnce();
});
it('shows shopping-specific artwork and confirmation', () => {
  const close = vi.fn();
  const {getByRole} = render(<CompletionScreen kind="shopping" onClose={close}/>);
  expect(getByRole('dialog').querySelector('img').src).toContain('/family-v3/celebration-shopping.png');
  fireEvent.click(getByRole('button', {name:'Nice!'}));
  expect(close).toHaveBeenCalledOnce();
});
it('opens the selected agenda event and handles empty days', () => {
  const select = vi.fn();
  const event = {id:'1', title:'School drop-off', start:'2026-09-16T08:00:00', location:'Maple Grove', eventType:'school'};
  const {getByRole, rerender, getByText} = render(<ReferenceAgenda events={[event]} onSelect={select} colorFor={()=> '#0088ff'}/>);
  fireEvent.click(getByRole('button'));
  expect(select).toHaveBeenCalledWith(event);
  rerender(<ReferenceAgenda events={[]} onSelect={select}/>);
  expect(getByText('No events planned for this day.')).toBeDefined();
});
