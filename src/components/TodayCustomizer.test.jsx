import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import TodayCustomizer from './TodayCustomizer';
afterEach(cleanup);
it('lets people toggle and reorder cards using accessible controls', () => {
  const onToggle = vi.fn(), onMove = vi.fn(), onReset = vi.fn(), onClose = vi.fn();
  render(<TodayCustomizer open onClose={onClose} cards={[{id:'weather',label:'Weather'},{id:'tasks',label:'Tasks'}]} hidden={['tasks']} onToggle={onToggle} onMove={onMove} onReset={onReset}/>);
  const dialog = screen.getByRole('dialog', {name:'Customize Today'});
  const switches = within(dialog).getAllByRole('switch');
  expect(switches[0]).toBeChecked(); expect(switches[1]).not.toBeChecked();
  fireEvent.click(switches[1]); expect(onToggle).toHaveBeenCalledWith('tasks');
  expect(within(dialog).getByRole('button',{name:'Move Weather earlier'})).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('button',{name:'Move Tasks earlier'})); expect(onMove).toHaveBeenCalledWith('tasks', -1);
  fireEvent.click(within(dialog).getByRole('button',{name:'Reset'})); expect(onReset).toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button',{name:'Done'})); expect(onClose).toHaveBeenCalled();
});
