import {it,expect,vi,afterEach} from 'vitest';
import {render,fireEvent,cleanup} from '@testing-library/react';
import BroadcastComposer from '../BroadcastComposer';
vi.mock('../BroadcastVoice',()=>({default:()=> <div>Recorder</div>}));
vi.mock('../../lib/supabase',()=>({supabase:{}}));
afterEach(cleanup);
const props={mode:'text',text:'',voice:null,recording:false,sending:false,onModeChange:vi.fn(),onSubmit:vi.fn(e=>e.preventDefault())};
it('offers explicit formats and rejects empty text',()=>{
 const ui=render(<BroadcastComposer {...props}/>);
 expect(ui.getByText('Send text broadcast').disabled).toBe(true);
 fireEvent.click(ui.getByRole('button',{name:'Voice note',exact:true}));
 expect(props.onModeChange).toHaveBeenCalledWith('voice');
});
it('voice mode cannot send a hidden text draft without a recording',()=>{
 const ui=render(<BroadcastComposer {...props} mode="voice" text="Existing text"/>);
 expect(ui.queryByRole('textbox')).toBeNull();
 expect(ui.getByText('Send voice note').disabled).toBe(true);
 ui.rerender(<BroadcastComposer {...props} mode="voice" voice={new Blob(['audio'])}/>);
 expect(ui.getByText('Send voice note').disabled).toBe(false);
 ui.rerender(<BroadcastComposer {...props} mode="voice" voice={new Blob(['audio'])} recording/>);
 expect(ui.getByText('Send voice note').disabled).toBe(true);
 expect(ui.getByRole('button',{name:'Text broadcast',exact:true}).disabled).toBe(true);
});
it('submits text and disables controls during sending',()=>{
 const ui=render(<BroadcastComposer {...props} text="Dinner is ready"/>);
 fireEvent.click(ui.getByText('Send text broadcast'));
 expect(props.onSubmit).toHaveBeenCalled();
 ui.rerender(<BroadcastComposer {...props} text="Dinner is ready" sending/>);
 expect(ui.getByRole('textbox').disabled).toBe(true);
 expect(ui.getByText('Sending…').disabled).toBe(true);
});
