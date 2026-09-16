import { useEffect, useRef, useState } from 'react';
import './voice-note-player.css';

const time = value => Number.isFinite(value) && value >= 0
  ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00';

// Shared by draft previews and received broadcasts. Never starts playback on mount.
export default function VoiceNotePlayer({ src, loading = false, error = '', onRetry, label = 'Voice note' }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failure, setFailure] = useState('');
  const [speed, setSpeed] = useState(1);
  const [peaks, setPeaks] = useState([]);
  useEffect(() => {
    setPlaying(false); setPosition(0); setDuration(0); setFailure(''); setPeaks([]);
    // MediaRecorder WebM files can report an infinite duration. Decode the actual
    // audio for its length and waveform, rather than inventing decorative bars.
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!src || !Context) return;
    const controller = new AbortController();
    let context;
    let cancelled = false;
    async function inspect() {
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok) return;
        const bytes = await response.arrayBuffer();
        if (cancelled || bytes.byteLength > 10 * 1024 * 1024) return;
        context = new Context();
        const buffer = await context.decodeAudioData(bytes);
        if (cancelled) return;
        const samples = buffer.getChannelData(0);
        const step = Math.max(1, Math.ceil(samples.length / 40));
        const bins = Array.from({ length: 40 }, (_, i) => {
          let peak = 0;
          for (let j = i * step; j < Math.min((i + 1) * step, samples.length); j++) peak = Math.max(peak, Math.abs(samples[j]));
          return peak;
        });
        const maximum = Math.max(...bins, 0.01);
        setPeaks(bins.map(value => Math.max(0.08, value / maximum)));
        setDuration(buffer.duration);
      } catch { /* Native playback remains available if waveform decoding fails. */ }
      finally { context?.close().catch(() => {}); }
    }
    inspect();
    return () => { cancelled = true; controller.abort(); };
  }, [src]);
  async function toggle() {
    if (!audio.current || !src) return;
    if (!audio.current.paused) { audio.current.pause(); return; }
    try {
      setFailure('');
      audio.current.playbackRate = speed;
      await audio.current.play();
    } catch { setFailure('Could not play this recording. Try again.'); }
  }
  function metadata() {
    const value = audio.current?.duration;
    if (Number.isFinite(value)) setDuration(value);
  }
  const issue = error || failure;
  return <div className="voice-note-player" role="group" aria-label={label} aria-busy={loading}>
    <audio ref={audio} src={src || undefined} preload="metadata"
      onLoadedMetadata={metadata} onDurationChange={metadata}
      onTimeUpdate={() => setPosition(audio.current.currentTime)}
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onEnded={() => { setPlaying(false); setPosition(0); audio.current.currentTime = 0; }}
      onError={() => setFailure('This recording could not be loaded. Try again.')} />
    <button type="button" className="voice-note-play" aria-label={playing ? 'Pause voice note' : 'Play voice note'}
      disabled={!src || loading || !!error} onClick={toggle}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
        {playing ? <path d="M6 4h4v16H6zM14 4h4v16h-4z"/> : <path d="M7 4v16l14-8z"/>}
      </svg>
    </button>
    <div className="voice-note-track">
      <div className="voice-note-caption"><strong>{label}</strong><span>{loading ? 'Loading audio…' : `${time(position)} / ${duration ? time(duration) : '—:—'}`}</span></div>
      {peaks.length > 0 && <svg className="voice-note-waveform" viewBox="0 0 200 24" preserveAspectRatio="none" aria-hidden="true">
        {peaks.map((peak, i) => <rect key={i} x={i * 5} y={12 - peak * 11} width="3" height={peak * 22} rx="1.5" fill="currentColor" opacity={duration && i / 40 <= position / duration ? 1 : 0.3} />)}
      </svg>}
      <input type="range" aria-label="Seek voice note" min="0" max={duration || 1} step="0.1"
        value={Math.min(position, duration || 1)} disabled={!src || !duration}
        onChange={e => { audio.current.currentTime = Number(e.target.value); setPosition(Number(e.target.value)); }} />
    </div>
    <button type="button" className="voice-note-speed" aria-label={`Playback speed ${speed} times`} disabled={!src}
      onClick={() => { const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1; setSpeed(next); audio.current.playbackRate = next; }}>{speed}×</button>
    {issue && <div className="voice-note-error" role="alert"><span>{issue}</span>
      <button type="button" onClick={() => { setFailure(''); if (onRetry) onRetry(); else audio.current?.load(); }}>Retry audio</button>
    </div>}
  </div>;
}
