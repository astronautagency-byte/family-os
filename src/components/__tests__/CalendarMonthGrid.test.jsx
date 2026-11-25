import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import CalendarMonthGrid from '../CalendarMonthGrid';
afterEach(cleanup);
const cells=Array.from({length:42},(_,i)=>new Date(2026,10,1+i));
const events=[
 {id:'a',title:'Soccer',start:'2026-11-03T16:00:00',end:'2026-11-03T17:00:00'},
 {id:'b',title:'School concert',start:'2026-11-26T18:00:00',end:'2026-11-26T19:00:00'},
 {id:'c',title:'Outside grid',start:'2026-12-20T09:00:00',end:'2026-12-20T10:00:00'},
];
const props={cells,month:new Date(2026,10,1),selectedDate:'2026-11-03',today:'2026-11-25',events,colorFor:()=> '#123456',onSelectDate:vi.fn()};
it('shows events across all six weeks rather than only the selected day',()=>{
 render(<CalendarMonthGrid {...props}/>);
 expect(screen.getAllByRole('button')).toHaveLength(42);
 expect(screen.getByText('Soccer')).toBeDefined();expect(screen.getByText('School concert')).toBeDefined();
 expect(screen.queryByText('Outside grid')).toBeNull();
 const concert=screen.getByRole('button',{name:/Thursday, November 26, 2026, 1 event: School concert/});
 fireEvent.click(concert);expect(props.onSelectDate).toHaveBeenCalledWith('2026-11-26');
 expect(screen.getByRole('button',{name:/Wednesday, November 25/}).getAttribute('aria-current')).toBe('date');
});
it('limits visible event previews while keeping every title in the accessible day label',()=>{
 const crowded=Array.from({length:5},(_,i)=>({...events[0],id:String(i),title:`Plan ${i}`}));
 render(<CalendarMonthGrid {...props} events={crowded}/>);
 const day=screen.getByRole('button',{name:/Tuesday, November 3, 2026, 5 events: Plan 0, Plan 1, Plan 2, Plan 3, Plan 4/});
 expect(within(day).getByText('+3 more')).toBeDefined();expect(within(day).queryByText('Plan 2')).toBeNull();
});
