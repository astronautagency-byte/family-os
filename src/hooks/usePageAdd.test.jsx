import { it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import usePageAdd, { requestPageAdd } from './usePageAdd';
function Page({ id, onAdd }) { usePageAdd(id,onAdd); return null; }
it('delivers an add request when a lazy page mounts, once only', () => {
  const add = vi.fn();
  requestPageAdd('tasks');
  const first = render(<Page id="tasks" onAdd={add}/>);
  expect(add).toHaveBeenCalledOnce();
  first.unmount();
  render(<Page id="tasks" onAdd={add}/>);
  expect(add).toHaveBeenCalledOnce();
});
it('handles repeated same-page actions with the latest callback', () => {
  const old = vi.fn(), current = vi.fn();
  const page = render(<Page id="calendar" onAdd={old}/>);
  page.rerender(<Page id="calendar" onAdd={current}/>);
  act(() => requestPageAdd('calendar'));
  expect(old).not.toHaveBeenCalled();
  expect(current).toHaveBeenCalledOnce();
});
