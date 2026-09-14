import {it,expect,afterEach} from 'vitest';
import {render,fireEvent,cleanup} from '@testing-library/react';
import {Avatar} from '../ui';
afterEach(cleanup);
it('derives initials and uses the shared circular size',()=>{
 const {container}=render(<Avatar member={{name:'Alex Vorobiev'}} size="lg"/>);
 const avatar=container.firstChild;
 expect(avatar.textContent).toBe('AV');
 expect(avatar.style.width).toBe('44px');
 expect(avatar.style.borderRadius).toBe('50%');
});
it('falls back after a broken photo and displays a replacement photo',()=>{
 const {container,rerender}=render(<Avatar member={{name:'Kat',avatarUrl:'/broken.png',color:'plum'}}/>);
 fireEvent.error(container.querySelector('img'));
 expect(container.querySelector('img')).toBeNull();
 expect(container.textContent).toBe('K');
 expect(container.firstChild.style.backgroundColor).not.toBe('white');
 rerender(<Avatar member={{name:'Kat',avatarUrl:'/new.png',color:'plum'}}/>);
 expect(container.querySelector('img').getAttribute('src')).toBe('/new.png');
});
