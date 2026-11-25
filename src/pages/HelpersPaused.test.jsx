import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import HelpersPaused from './HelpersPaused';
afterEach(()=>{cleanup();sessionStorage.clear();});
it('clears stored helper credentials and private links without opening the old portal',()=>{
 sessionStorage.setItem('famos:guest-helper','private session');
 window.history.replaceState(null,'','/helpers#invite=private-token');
 render(<HelpersPaused/>);
 expect(sessionStorage.getItem('famos:guest-helper')).toBeNull();
 expect(window.location.hash).toBe('');
 expect(screen.getByRole('heading',{name:'Helper access is paused'})).toBeDefined();
 expect(screen.queryByLabelText('Passcode')).toBeNull();
 expect(screen.getByRole('link',{name:'Open FamOS'}).getAttribute('href')).toBe('https://home.fam-os.app/');
});
