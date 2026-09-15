import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import FamilyCardRail from '../FamilyCardRail';
import FamilyIllustration, { FAMILY_ART } from '../FamilyIllustration';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const cards = [
  {id:'calendar',label:'Schedule',title:'2 events today',detail:'School pickup',action:'Open calendar'},
  {id:'tasks',label:'Chores',title:'3 tasks to do',detail:'Work together',action:'View tasks'},
];
it('keeps every card action accessible without swiping', () => {
  const select = vi.fn();
  render(<FamilyCardRail title="Today" cards={cards} onSelect={select}/>);
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button',{name:'View tasks'}));
  expect(select).toHaveBeenCalledWith('tasks');
});
it('renders nothing when no enabled cards remain', () => {
  const {container}=render(<FamilyCardRail title="Today" cards={[]}/>);
  expect(container.innerHTML).toBe('');
});
it('provides scroll controls and disables them when everything fits', () => {
  render(<FamilyCardRail title="Today" cards={cards}/>);
  expect(screen.getByRole('button',{name:'Previous today cards'}).disabled).toBe(true);
  expect(screen.getByRole('button',{name:'Next today cards'}).disabled).toBe(true);
});
it('uses no smooth scrolling when reduced motion is requested', () => {
  const scrollBy=vi.fn();
  const {container}=render(<FamilyCardRail title="Today" cards={cards}/>);
  const rail=container.querySelector('.family-card-rail');
  Object.defineProperty(rail,'scrollWidth',{value:900,configurable:true});
  Object.defineProperty(rail,'clientWidth',{value:300,configurable:true});
  rail.scrollBy=scrollBy;
  vi.stubGlobal('matchMedia',()=>({matches:true}));
  fireEvent.scroll(rail);
  fireEvent.click(screen.getByRole('button',{name:'Next today cards'}));
  expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({behavior:'auto'}));
  vi.unstubAllGlobals();
});
it('uses independent images and treats decorative artwork as decorative', () => {
  const {container}=render(<FamilyIllustration variant="tasks"/>);
  expect(container.querySelector('img').getAttribute('src')).toBe('/illustrations/family-v4/tasks.png');
  expect(container.querySelector('img').getAttribute('alt')).toBe('');
  expect(FAMILY_ART.recipes).toBe('meals');
});
