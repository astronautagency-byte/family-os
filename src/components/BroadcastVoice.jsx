import { forwardRef, useImperativeHandle, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import VoiceNotePlayer from './VoiceNotePlayer';

export function BroadcastAudio({ path }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setUrl(''); setError('');
    setLoading(true);
    async function load() {
      try {
        if (!path) throw new Error('Missing audio');
        const { data, error } = await supabase.storage.from('broadcast-voice').createSignedUrl(path, 3600);
        if (error || !data?.signedUrl) throw error || new Error('Missing audio URL');
        if (!cancelled) setUrl(data.signedUrl);
      } catch { if (!cancelled) setError('Could not load voice note. Try again.'); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [path, attempt]);
  // Prepare the private player immediately; playback still requires a tap.
  return <VoiceNotePlayer src={url} loading={loading} error={error} onRetry={() => setAttempt(n => n + 1)} />;
}

export default forwardRef(function BroadcastVoice({ value, onChange, disabled, onRecordingChange }, ref) {
  const recorder = useRef(null);
  const stream = useRef(null);
  const cancelled = useRef(false);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [level,setLevel]=useState(0);
  const heard=useRef(false);
  const measured=useRef(false);
  useImperativeHandle(ref,()=>({start}));
  useEffect(()=>{
    if(!recording || !stream.current) return;
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context) return;
    let context, timer;
    try {
      context=new Context();
      const source=context.createMediaStreamSource(stream.current);
      const analyser=context.createAnalyser(); analyser.fftSize=512; source.connect(analyser);
      const samples=new Uint8Array(analyser.fftSize);
      context.resume().catch(()=>{});
      timer=setInterval(()=>{
        if(context.state!=='running') return;
        measured.current=true;
        analyser.getByteTimeDomainData(samples);
        const rms=Math.sqrt(samples.reduce((sum,n)=>sum+((n-128)/128)**2,0)/samples.length);
        if(rms>.008) heard.current=true;
        setLevel(Math.min(1,rms*8));
      },100);
    } catch { /* Recording remains available when level monitoring is unsupported. */ }
    return ()=>{clearInterval(timer);context?.close().catch(()=>{});};
  },[recording]);
  useEffect(() => {
    if (!value) { setUrl(''); return; }
    const next = URL.createObjectURL(value);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [value]);
  useEffect(() => () => {
    cancelled.current = true;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
  }, []);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds(n => n + 1), 1000);
    const limit = setTimeout(() => recorder.current?.state === 'recording' && recorder.current.stop(), 60000);
    return () => { clearInterval(timer); clearTimeout(limit); };
  }, [recording]);
  async function start() {
    if(disabled || pending || recorder.current?.state==='recording') return;
    heard.current=false; measured.current=false; setLevel(0);
    setError(''); cancelled.current = false;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError('Voice recording needs a supported browser and a secure connection.'); return; }
    setPending(true); onRecordingChange(true);
    try {
      const input = await navigator.mediaDevices.getUserMedia({audio:true});
      if (cancelled.current) { input.getTracks().forEach(track => track.stop()); return; }
      stream.current = input;
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type));
      const next = new MediaRecorder(input, mimeType ? {mimeType} : undefined);
      recorder.current = next;
      const chunks = [];
      let failed = false;
      next.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      next.onstop = () => {
        input.getTracks().forEach(track => track.stop());
        if (cancelled.current) return;
        setRecording(false); onRecordingChange(false);
        if (failed) return;
        if(measured.current && !heard.current) { setError('No microphone sound detected. Check your input device, then record again.'); return; }
        const blob = new Blob(chunks, {type: next.mimeType});
        if (!blob.size || blob.size > 10 * 1024 * 1024) setError('Recording was empty or too large. Please try again.');
        else onChange(blob);
      };
      next.onerror = () => { failed = true; setError('Recording failed. Please try again.'); if (next.state !== 'inactive') next.stop(); input.getTracks().forEach(track => track.stop()); setRecording(false); onRecordingChange(false); };
      next.start(); setSeconds(0); setRecording(true);
    } catch (error) { stream.current?.getTracks().forEach(track => track.stop()); setError(error.name==='NotAllowedError'?'Microphone access is blocked. Allow it in your browser’s site settings, then try again.':error.name==='NotFoundError'?'No microphone found. Connect one and try again.':'Microphone unavailable. Close other apps using it and try again.'); onRecordingChange(false); }
    finally { setPending(false); }
  }
  function cancel() {
    cancelled.current = true;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    setRecording(false); onRecordingChange(false); onChange(null);
  }
  return <div className="broadcast-voice-controls" style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',padding:'12px 0'}}>
    {recording ? <><span role="status">Recording · {seconds}s / 60s · {heard.current?'Sound detected':'Speak into your microphone'}</span><meter min="0" max="1" value={level} aria-label="Microphone input level"/><button type="button" onClick={() => recorder.current.stop()}>Stop recording</button><button type="button" onClick={cancel}>Cancel</button></>
      : value ? <><VoiceNotePlayer src={url} label="Preview voice note" /><button type="button" disabled={disabled} onClick={() => onChange(null)}>Remove voice note</button></>
      : <><button type="button" disabled={disabled || pending} onClick={start}>{pending ? 'Waiting for microphone…' : 'Record voice note'}</button>{pending && <button type="button" onClick={cancel}>Cancel microphone request</button>}</>}
    <small>Up to 1 minute · shared with your household when you broadcast</small>
    {error && <span role="alert">{error}</span>}
  </div>;
});
