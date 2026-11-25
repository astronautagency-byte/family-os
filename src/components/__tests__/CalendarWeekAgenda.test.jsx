import {render,screen,within,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import ReferenceAgenda,{WeekAgenda} from '../ReferenceAgenda';
afterEach(cleanup);
const dates=Array.from({length:7},(_,i)=>new Date(2026,10,22+i));
const events=[{id:'a',title:'Monday soccer',start:'2026-11-23T15:00:00',end:'2026-11-23T16:00:00',allDay:false},{id:'b',title:'Friday school',start:'2026-11-27T09:00:00',end:'2026-11-27T10:00:00',allDay:false},{id:'c',title:'Next week',start:'2026-11-30T09:00:00',end:'2026-11-30T10:00:00',allDay:false}];
it('shows all seven days and groups events into the selected week',()=>{
 const add=vi.fn(),select=vi.fn();
 render(<WeekAgenda dates={dates} events={events} onAdd={add} onSelect={select} colorFor={()=>'#123'}/>);
 expect(screen.getAllByRole('heading')).toHaveLength(7);
 expect(within(screen.getByRole('region',{name:'Monday, November 23'})).getByText('Monday soccer')).toBeDefined();
 expect(within(screen.getByRole('region',{name:'Friday, November 27'})).getByText('Friday school')).toBeDefined();
 expect(screen.queryByText('Next week')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Add event on 2026-11-27'}));expect(add).toHaveBeenCalledWith('2026-11-27');
 fireEvent.click(screen.getByRole('button',{name:/Monday soccer/}));expect(select).toHaveBeenCalledWith(events[0]);
});
it('keeps day view scoped to the supplied selected-day events',()=>{
 render(<ReferenceAgenda events={[events[0]]} onSelect={vi.fn()} colorFor={()=>'#123'}/>);
 expect(screen.getByText('Monday soccer')).toBeDefined();expect(screen.queryByText('Friday school')).toBeNull();
});
