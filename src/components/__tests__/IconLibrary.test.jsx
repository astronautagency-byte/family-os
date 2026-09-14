import {it,expect,vi,afterEach} from 'vitest';
import {render,cleanup,fireEvent} from '@testing-library/react';
import {createRef} from 'react';
import * as icons from '../icons';
afterEach(cleanup);
it('renders every exported icon at compact sizes',()=>{
  for(const [name,Icon] of Object.entries(icons)){
    const {container,unmount}=render(<Icon size={16}/>);
    expect(container.querySelector('svg').dataset.famosIcon).toBe(name);
    expect(container.querySelector('svg').getAttribute('width')).toBe('16');
    expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    unmount();
  }
});
it('preserves refs, accessibility, click handlers and caller classes',()=>{
  const ref=createRef(),click=vi.fn();
  const {getByRole}=render(<icons.CalendarDays ref={ref} role="img" aria-label="Calendar" onClick={click} className="caller-class"/>);
  expect(ref.current).toBe(getByRole('img',{name:'Calendar'}));
  expect(ref.current.classList.contains('caller-class')).toBe(true);
  expect(ref.current.hasAttribute('aria-hidden')).toBe(false);
  fireEvent.click(ref.current);expect(click).toHaveBeenCalledOnce();
});
it('keeps utility icons legible on coloured action buttons',()=>{
  const {container}=render(<icons.Plus color="white" size={20}/>);
  expect(container.querySelector('svg').getAttribute('stroke')).toBe('white');
  expect(container.querySelector('.famos-icon-wash')).toBeNull();
});
