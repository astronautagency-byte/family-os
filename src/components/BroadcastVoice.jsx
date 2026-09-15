import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export function BroadcastAudio({ path }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  async function load() {
    const { data, error } = await supabase.storage.from('broadcast-voice').createSignedUrl(path, 3600);
    if (error) setError('Could not load voice note. Try again.');
    else { setUrl(data.signedUrl); setError(''); }
  }
  // Fetch only on demand; recordings never use public URLs or autoplay.
  return url ? <audio controls src={url} onError={() => { setUrl(''); setError('Playback expired. Load again.'); }} style={{maxWidth:'100%'}} />
    : <button type="button" onClick={load}>{error || 'Play voice note'}</button>;
}

export default function BroadcastVoice({ value, onChange, disabled, onRecordingChange }) {
  const recorder = useRef(null);
  const stream = useRef(null);
  const cancelled = useRef(false);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
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
      next.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      next.onstop = () => {
        input.getTracks().forEach(track => track.stop());
        if (cancelled.current) return;
        setRecording(false); onRecordingChange(false);
        const blob = new Blob(chunks, {type: next.mimeType});
        if (!blob.size || blob.size > 10 * 1024 * 1024) setError('Recording was empty or too large. Please try again.');
        else onChange(blob);
      };
      next.onerror = () => { setError('Recording failed. Please try again.'); next.stop(); };
      next.start(); setSeconds(0); setRecording(true);
    } catch { stream.current?.getTracks().forEach(track => track.stop()); setError('Microphone unavailable. Allow microphone access and try again.'); onRecordingChange(false); }
    finally { setPending(false); }
  }
  function cancel() {
    cancelled.current = true;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    setRecording(false); setPending(false); onRecordingChange(false); onChange(null);
  }
  return <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',padding:'12px 0'}}>
    {recording ? <><span role="status">Recording · {seconds}s / 60s</span><button type="button" onClick={() => recorder.current.stop()}>Stop recording</button><button type="button" onClick={cancel}>Cancel</button></>
      : value ? <><audio controls src={url} style={{maxWidth:'100%'}} /><button type="button" disabled={disabled} onClick={() => onChange(null)}>Remove voice note</button></>
      : <button type="button" disabled={disabled || pending} onClick={start}>{pending ? 'Waiting for microphone…' : 'Record voice note'}</button>}
    <small>Up to 1 minute · shared with your household when you broadcast</small>
    {error && <span role="alert">{error}</span>}
  </div>;
}
