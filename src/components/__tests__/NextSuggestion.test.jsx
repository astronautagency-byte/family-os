import {afterEach,expect,it,vi} from 'vitest';import {cleanup,fireEvent,render,screen} from '@testing-library/react';import NextSuggestion from '../NextSuggestion';
afterEach(cleanup);
it('shows a long event with its time and keeps navigation and dismissal independent',()=>{const open=vi.fn(),dismiss=vi.fn();render(<NextSuggestion suggestion={{page:'calendar',title:'Coming up soon',detail:"Pick up Walmart Order/get Deli, dolce + Meats at Longo's",action:'View calendar',when:'12:00 PM'}} onOpen={open} onDismiss={dismiss}/>);expect(screen.getByText(/12:00 PM/)).toBeDefined();expect(screen.getByText(/Walmart/)).toBeDefined();fireEvent.click(screen.getByRole('button',{name:/View calendar/}));expect(open).toHaveBeenCalledWith('calendar');fireEvent.click(screen.getByRole('button',{name:'Dismiss suggestion for today'}));expect(dismiss).toHaveBeenCalledTimes(1);expect(open).toHaveBeenCalledTimes(1);});

it('uses the same card for a scheduled event without adding a dismiss control', () => {
  const open = vi.fn();
  render(<NextSuggestion suggestion={{page:'calendar', title:'Soccer practice', action:'View calendar', when:'All day'}} onOpen={open} />);
  const card = screen.getByRole('button', { name: /up next.*all day.*soccer practice.*view calendar/i });
  expect(card).toHaveClass('today-next', 'today-next--calendar');
  expect(screen.queryByRole('button', { name: 'Dismiss suggestion for today' })).toBeNull();
  fireEvent.click(card);
  expect(open).toHaveBeenCalledWith('calendar');
});
