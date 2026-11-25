import {afterEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createPortal} from 'react-dom';
import PullToRefresh from '../PullToRefresh';

afterEach(cleanup);
function touch(target, type, y) {
  const event = new MouseEvent(type, {bubbles:true, clientX:20, clientY:y});
  Object.defineProperty(event, 'pointerType', {value:'touch'});
  fireEvent(target,event);
}
function gesture(target) {
  touch(target,'pointerdown',10);
  touch(target,'pointermove',180);
}
function Fixture({refresh}) {
  return <PullToRefresh onRefresh={refresh}>
    <p>Page background</p>
    <button aria-label="Remove task"><svg data-testid="remove-icon"/></button>
    {createPortal(<button>Dialog control</button>, document.body)}
  </PullToRefresh>;
}
it('does not hijack a gesture on a nested button icon or dialog portal', () => {
  const refresh=vi.fn(); const {container}=render(<Fixture refresh={refresh}/>);
  gesture(screen.getByTestId('remove-icon'));
  expect(container.firstChild.style.transform).toBe('none');
  touch(document.documentElement,'pointerup',180);
  gesture(screen.getByRole('button',{name:'Dialog control'}));
  expect(container.firstChild.style.transform).toBe('none');
  touch(document.documentElement,'pointerup',180);
  expect(refresh).not.toHaveBeenCalled();
});
it('still refreshes when pulling the page background', async () => {
  const refresh=vi.fn(); const {container}=render(<Fixture refresh={refresh}/>);
  gesture(screen.getByText('Page background'));
  expect(container.firstChild.style.transform).toContain('translate3d');
  touch(document.documentElement,'pointerup',180);
  await waitFor(()=>expect(refresh).toHaveBeenCalledOnce());
});
