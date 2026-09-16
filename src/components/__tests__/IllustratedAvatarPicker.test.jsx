import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import IllustratedAvatarPicker from '../IllustratedAvatarPicker';
import {ILLUSTRATED_AVATARS} from '../../data/illustratedAvatars';
afterEach(cleanup);
it('keeps uploaded photos unchanged until a user explicitly chooses',()=>{
 const change=vi.fn();render(<IllustratedAvatarPicker value="data:image/png;base64,photo" onChange={change}/>);
 expect(change).not.toHaveBeenCalled();
 expect(screen.getAllByRole('button',{name:/^Choose /})).toHaveLength(22);
 expect(screen.getAllByRole('button',{name:/^Choose /}).every(button=>button.getAttribute('aria-pressed')==='false')).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Choose Peach hijab'}));
 expect(change).toHaveBeenCalledWith('/avatars/flat-v1/adult-hijab.png');
});
it('shows the saved selection and uses distinct local images',()=>{
 render(<IllustratedAvatarPicker value={ILLUSTRATED_AVATARS[0].url} onChange={()=>{}}/>);
 expect(screen.getByRole('button',{name:'Choose Auburn hair'}).getAttribute('aria-pressed')).toBe('true');
 expect(new Set(ILLUSTRATED_AVATARS.map(item=>item.url)).size).toBe(22);
 expect(ILLUSTRATED_AVATARS.every(item=>/^\/avatars\/flat-v[12]\//.test(item.url))).toBe(true);
});
it('filters by age without changing the selected profile',()=>{
 const change=vi.fn();render(<IllustratedAvatarPicker value="/avatars/flat-v2/adult-bald.png" onChange={change}/>);
 fireEvent.click(screen.getByRole('button',{name:'Kids & teens',exact:true}));
 expect(screen.getAllByRole('button',{name:/^Choose /})).toHaveLength(7);
 expect(change).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Adults',exact:true}));
 expect(screen.getByRole('button',{name:'Choose Bald and bearded'}).getAttribute('aria-pressed')).toBe('true');
});
