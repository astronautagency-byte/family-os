import {afterEach,expect,it,vi} from 'vitest';
import {useState} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ChoiceChip,Modal,OptionsMenu,SelectField} from '../ui';
afterEach(cleanup);
it('keeps select labels, hints, validation and the native change event connected',()=>{
 const change=vi.fn();
 const {rerender}=render(<SelectField label="Calendar" hint="Choose where to save" value="home" onChange={change}><option value="home">Home</option><option value="school">School</option></SelectField>);
 const field=screen.getByRole('combobox',{name:'Calendar'});
 expect(document.getElementById(field.getAttribute('aria-describedby'))).toHaveTextContent('Choose where to save');
 fireEvent.change(field,{target:{value:'school'}});expect(change).toHaveBeenCalledOnce();
 rerender(<SelectField label="Calendar" error="Choose an available calendar" value="home" onChange={change}><option value="home">Home</option></SelectField>);
 expect(field).toHaveAttribute('aria-invalid','true');
 expect(document.getElementById(field.getAttribute('aria-describedby'))).toHaveTextContent('Choose an available calendar');
});
it('supports multi-select chips with a keyboard without submitting their form',async()=>{
 const submit=vi.fn();function Fixture(){const [vegan,setVegan]=useState(false);return <form onSubmit={submit}><ChoiceChip checked={vegan} onChange={e=>setVegan(e.target.checked)}>Vegan</ChoiceChip><ChoiceChip checked={false} disabled onChange={()=>{}}>Gluten-free</ChoiceChip></form>;}
 render(<Fixture/>);const user=userEvent.setup();
 await user.tab();expect(screen.getByRole('checkbox',{name:'Vegan'})).toHaveFocus();
 await user.keyboard(' ');expect(screen.getByRole('checkbox',{name:'Vegan'})).toBeChecked();
 expect(screen.getByRole('checkbox',{name:'Gluten-free'})).toBeDisabled();expect(submit).not.toHaveBeenCalled();
});
it('closes options on Escape and restores focus to its trigger',async()=>{
 render(<OptionsMenu label="Task options"><button>New list</button></OptionsMenu>);
 const user=userEvent.setup(),trigger=screen.getByLabelText('Task options');await user.click(trigger);
 expect(trigger.closest('details').open).toBe(true);await user.click(screen.getByRole('button',{name:'New list'}));await user.keyboard('{Escape}');
 expect(trigger.closest('details').open).toBe(false);expect(trigger).toHaveFocus();
});
it('closes an options panel on outside input without stealing that input focus',async()=>{
 render(<><OptionsMenu label="Shopping options"><button>New list</button></OptionsMenu><button>Outside</button></>);
 const user=userEvent.setup(),trigger=screen.getByLabelText('Shopping options');await user.click(trigger);await user.click(screen.getByRole('button',{name:'Outside'}));
 expect(trigger.closest('details').open).toBe(false);expect(screen.getByRole('button',{name:'Outside'})).toHaveFocus();
});
it('leaves Escape handling to an active modal instead of closing the menu beneath it',()=>{
 const close=vi.fn();const {rerender}=render(<OptionsMenu label="Task options">Content</OptionsMenu>);
 const trigger=screen.getByLabelText('Task options');fireEvent.click(trigger);
 rerender(<><OptionsMenu label="Task options">Content</OptionsMenu><Modal open onClose={close} title="New list"><input aria-label="List name"/></Modal></>);
 fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});
 expect(close).toHaveBeenCalledOnce();expect(screen.getByLabelText('Task options').closest('details').open).toBe(true);
});
it('announces an active filter without relying on the coloured indicator',()=>{
 render(<OptionsMenu label="Task options" active>Content</OptionsMenu>);
 const trigger=screen.getByLabelText('Task options');
 expect(document.getElementById(trigger.getAttribute('aria-describedby'))).toHaveTextContent('Filters active');
});
