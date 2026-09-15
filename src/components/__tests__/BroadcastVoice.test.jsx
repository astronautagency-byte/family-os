import { it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import BroadcastVoice from '../BroadcastVoice';
vi.mock('../../lib/supabase', () => ({supabase:{}}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('records only after an explicit click and releases microphone on stop', async () => {
  const stop = vi.fn();
  const getUserMedia = vi.fn().mockResolvedValue({getTracks:()=>[{stop}]});
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia}});
  class Recorder {
    static isTypeSupported() { return true; }
    mimeType='audio/webm'; state='inactive';
    start() { this.state='recording'; }
    stop() { this.state='inactive'; this.ondataavailable({data:new Blob(['audio'])}); this.onstop(); }
  }
  vi.stubGlobal('MediaRecorder',Recorder);
  const change=vi.fn();
  const ui=render(<BroadcastVoice onChange={change} onRecordingChange={()=>{}} />);
  expect(getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(ui.getByText('Record voice note'));
  await waitFor(()=>expect(ui.getByText('Stop recording')).toBeTruthy());
  fireEvent.click(ui.getByText('Stop recording'));
  expect(stop).toHaveBeenCalled();
  expect(change.mock.calls[0][0].type).toBe('audio/webm');
});
it('explains denied microphone access without sending a draft',async()=>{
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn().mockRejectedValue(new Error('denied'))}});
  vi.stubGlobal('MediaRecorder',class {});
  const change=vi.fn();
  const ui=render(<BroadcastVoice onChange={change} onRecordingChange={()=>{}} />);
  fireEvent.click(ui.getByText('Record voice note'));
  await waitFor(()=>expect(ui.getByRole('alert').textContent).toContain('Microphone unavailable'));
  expect(change).not.toHaveBeenCalled();
});
