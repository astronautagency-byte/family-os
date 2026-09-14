import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {Modal} from '../ui';
afterEach(cleanup);
it('contains keyboard focus and restores the opener',()=>{
 const close=vi.fn();
 const {rerender}=render(<><button>Open editor</button><Modal open={false} onClose={close} title="Editor"><button>Save</button></Modal></>);
 const opener=screen.getByRole('button',{name:'Open editor'});opener.focus();
 rerender(<><button>Open editor</button><Modal open onClose={close} title="Editor"><button>Save</button></Modal></>);
 expect(document.activeElement).toBe(screen.getByRole('dialog'));
 fireEvent.keyDown(document,{key:'Tab'});
 expect(document.activeElement).toBe(screen.getByRole('button',{name:'Close dialog'}));
 screen.getByRole('button',{name:'Save'}).focus();
 fireEvent.keyDown(document,{key:'Tab'});
 expect(document.activeElement).toBe(screen.getByRole('button',{name:'Close dialog'}));
 fireEvent.keyDown(document,{key:'Escape'});expect(close).toHaveBeenCalledOnce();
 rerender(<><button>Open editor</button><Modal open={false} onClose={close} title="Editor"><button>Save</button></Modal></>);
 expect(document.activeElement).toBe(opener);
});
