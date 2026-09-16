import { it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import BroadcastVoice, { BroadcastAudio } from '../BroadcastVoice';
const signing=vi.hoisted(()=>vi.fn());
vi.mock('../../lib/supabase', () => ({supabase:{storage:{from:()=>({createSignedUrl:signing})}}}));
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
it('releases a stream granted after the permission request was cancelled',async()=>{
  let grant;
  const stop=vi.fn(),change=vi.fn();
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>new Promise(resolve=>{grant=resolve;})}});
  vi.stubGlobal('MediaRecorder',class {});
  const ui=render(<BroadcastVoice onChange={change} onRecordingChange={()=>{}}/>);
  fireEvent.click(ui.getByText('Record voice note'));
  fireEvent.click(ui.getByText('Cancel microphone request'));
  grant({getTracks:()=>[{stop}]});
  await waitFor(()=>expect(stop).toHaveBeenCalledOnce());
  expect(change).toHaveBeenCalledWith(null);
  expect(ui.queryByText('Stop recording')).toBeNull();
});
it('handles playback loading failures and permits retry without autoplay',async()=>{
  signing.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({data:{signedUrl:'https://example.test/audio'},error:null});
  const ui=render(<BroadcastAudio path="household/sender/note"/>);
  await waitFor(()=>expect(ui.getByText('Could not load voice note. Try again.')).toBeTruthy());
  fireEvent.click(ui.getByText('Retry audio'));
  await waitFor(()=>expect(ui.container.querySelector('audio').getAttribute('src')).toBe('https://example.test/audio'));
  expect(ui.container.querySelector('audio').autoplay).toBe(false);
});
it('prepares a received private recording without requiring a separate load click',async()=>{
  signing.mockResolvedValue({data:{signedUrl:'https://example.test/received'},error:null});
  const ui=render(<BroadcastAudio path="household/sender/received"/>);
  await waitFor(()=>expect(ui.getByRole('button',{name:'Play voice note'}).disabled).toBe(false));
  expect(signing).toHaveBeenLastCalledWith('household/sender/received',3600);
  expect(ui.container.querySelector('audio').getAttribute('src')).toBe('https://example.test/received');
  expect(ui.container.querySelector('audio').autoplay).toBe(false);
});
it('does not replace a new recording with a late signed URL from the previous one',async()=>{
  let resolveOld;
  signing.mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve;}))
    .mockResolvedValueOnce({data:{signedUrl:'https://example.test/new'},error:null});
  const ui=render(<BroadcastAudio path="household/sender/old"/>);
  ui.rerender(<BroadcastAudio path="household/sender/new"/>);
  await waitFor(()=>expect(ui.container.querySelector('audio').getAttribute('src')).toBe('https://example.test/new'));
  resolveOld({data:{signedUrl:'https://example.test/old'},error:null});
  await waitFor(()=>expect(ui.container.querySelector('audio').getAttribute('src')).toBe('https://example.test/new'));
});
