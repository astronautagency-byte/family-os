import React from 'react';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CalendarImageImport from '../CalendarImageImport';
import { readRecipePhotos } from '../../lib/recipeImport';
import { invokeEdgeFunction } from '../../lib/supabase';
vi.mock('../../lib/recipeImport',()=>({readRecipePhotos:vi.fn()}));
vi.mock('../../lib/supabase',()=>({invokeEdgeFunction:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
async function uploadAndRead() {
  fireEvent.change(screen.getByLabelText(/Choose event or calendar photos/),{target:{files:[new File(['photo'],'calendar.png',{type:'image/png'})]}});
  await waitFor(()=>expect(screen.getByAltText('Selected source image 1')).toBeTruthy());
  fireEvent.change(screen.getByLabelText(/Month and year/),{target:{value:'2026-11'}});
  fireEvent.click(screen.getByRole('button',{name:'Read images'}));
  await screen.findByText('Review 2 events');
}
it('requires review, and retries only unsaved events after a partial failure',async()=>{
  readRecipePhotos.mockResolvedValue(['data:image/jpeg;base64,YQ==']);
  invokeEdgeFunction.mockResolvedValue({events:[{title:'Concert',date:'2026-11-06',allDay:true},{title:'Trip',date:'2026-11-07',allDay:true}]});
  const addEvent=vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(Error('Offline')).mockResolvedValueOnce(undefined);
  render(<CalendarImageImport onClose={()=>{}} addEvent={addEvent}/>);
  await uploadAndRead();
  expect(addEvent).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Add 2 selected events'}));
  await screen.findByRole('alert');
  expect(addEvent).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button',{name:'Add 1 selected event'}));
  await waitFor(()=>expect(addEvent).toHaveBeenCalledTimes(3));
  expect(addEvent.mock.calls[2][0].title).toBe('Trip');
});
it('skips existing events and validates every selected draft before any save',async()=>{
  readRecipePhotos.mockResolvedValue(['data:image/jpeg;base64,YQ==']);
  invokeEdgeFunction.mockResolvedValue({events:[{title:'Concert',date:'2026-11-06',allDay:true},{title:'Trip',date:'',allDay:true}]});
  const addEvent=vi.fn();
  render(<CalendarImageImport onClose={()=>{}} addEvent={addEvent} events={[{title:'Concert',start:new Date('2026-11-06T00:00:00').toISOString()}]}/>);
  await uploadAndRead();
  fireEvent.click(screen.getByRole('button',{name:'Add 2 selected events'}));
  await screen.findByRole('alert');
  expect(addEvent).not.toHaveBeenCalled();
  fireEvent.change(screen.getAllByLabelText('Start date')[1],{target:{value:'2026-11-07'}});
  fireEvent.click(screen.getByRole('button',{name:'Add 2 selected events'}));
  await screen.findByText('Already on calendar');
  await waitFor(()=>expect(addEvent).toHaveBeenCalledTimes(1));
  expect(addEvent.mock.calls[0][0].title).toBe('Trip');
});
