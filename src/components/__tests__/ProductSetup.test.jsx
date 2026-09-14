import {it,expect,vi,afterEach} from 'vitest';
import {render,fireEvent,cleanup} from '@testing-library/react';
import QuantityUnitFields from '../QuantityUnitFields';
import StapleStarter from '../StapleStarter';
import {mergeStarterStaples} from '../../data/starterStaples';
afterEach(cleanup);
it('accepts fractional quantities and preserves existing custom units',()=>{
  const change=vi.fn();const {getByLabelText}=render(<QuantityUnitFields quantity={1} unit="bunch" onChange={change}/>);
  expect(getByLabelText('Unit').value).toBe('bunch');
  fireEvent.change(getByLabelText('Quantity'),{target:{value:'0.5'}});
  expect(change).toHaveBeenCalledWith({quantity:0.5});
  fireEvent.change(getByLabelText('Unit'),{target:{value:'kg'}});
  expect(change).toHaveBeenCalledWith({unit:'kg'});
});
it('keeps existing staples and deduplicates across packs',()=>{
  const existing=[{id:'mine',name:' Rice ',quantity:4}];
  const result=mergeStarterStaples(existing,[{name:'rice',quantity:1},{name:'Milk'},{name:'milk'}]);
  expect(result).toHaveLength(2);expect(result[0]).toBe(existing[0]);
});
it('only adds explicitly selected starter items',()=>{
  const add=vi.fn();const {getByRole,getByLabelText}=render(<StapleStarter onAdd={add}/>);
  fireEvent.click(getByRole('button',{name:'Choose starter staples'}));
  fireEvent.click(getByLabelText(/Eggs/));
  fireEvent.click(getByRole('button',{name:'Save 1 staples'}));
  expect(add).toHaveBeenCalledWith([expect.objectContaining({name:'Eggs',quantity:1,unit:'dozen'})]);
});
