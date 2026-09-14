import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {ColorSchemePicker} from '../ColorSchemePicker';
import {APP_COLOR_SCHEMES} from '../../data/appColorSchemes';
afterEach(cleanup);
it('restores all scheme choices and selects the saved scheme',()=>{
 const change=vi.fn();render(<ColorSchemePicker value="ocean" onChange={change}/>);
 fireEvent.click(screen.getByRole('button',{name:'App colour schemes'}));
 expect(screen.getAllByRole('option')).toHaveLength(APP_COLOR_SCHEMES.length);
 expect(screen.getByRole('option',{name:/Electric Coast/}).getAttribute('aria-selected')).toBe('true');
 fireEvent.click(screen.getByRole('option',{name:/Lavender Fields/}));
 expect(change).toHaveBeenCalledWith('lavender');
 expect(screen.queryByRole('listbox')).toBeNull();
});
