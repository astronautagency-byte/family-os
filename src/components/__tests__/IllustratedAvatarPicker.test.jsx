import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import IllustratedAvatarPicker from '../IllustratedAvatarPicker';
import {ILLUSTRATED_AVATARS} from '../../data/illustratedAvatars';
afterEach(cleanup);
it('keeps uploaded photos unchanged until a user explicitly chooses',()=>{
 const change=vi.fn();render(<IllustratedAvatarPicker value="data:image/png;base64,photo" onChange={change}/>);
 expect(change).not.toHaveBeenCalled();
 expect(screen.getAllByRole('button')).toHaveLength(10);
 expect(screen.getAllByRole('button').every(button=>button.getAttribute('aria-pressed')==='false')).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Choose Peach hijab'}));
 expect(change).toHaveBeenCalledWith('/avatars/flat-v1/adult-hijab.png');
});
it('shows the saved selection and uses distinct local images',()=>{
 render(<IllustratedAvatarPicker value={ILLUSTRATED_AVATARS[0].url} onChange={()=>{}}/>);
 expect(screen.getByRole('button',{name:'Choose Auburn hair'}).getAttribute('aria-pressed')).toBe('true');
 expect(new Set(ILLUSTRATED_AVATARS.map(item=>item.url)).size).toBe(10);
 expect(ILLUSTRATED_AVATARS.every(item=>item.url.startsWith('/avatars/flat-v1/'))).toBe(true);
});
