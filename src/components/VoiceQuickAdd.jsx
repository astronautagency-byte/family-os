import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from './icons';
import { Modal, PrimaryButton, SecondaryButton, TextField } from './ui';
import { useFamily } from '../context/FamilyContext';
import { parseVoiceQuickAdd, parseVoiceConfirmation } from '../lib/voiceQuickAdd';
import './voice-quick-add.css';

export default function VoiceQuickAdd({ features = {}, hidden = false }) {
  const { addGrocery, addTask } = useFamily();
  const [open, setOpen] = useState(false), [listening, setListening] = useState(false), [transcript, setTranscript] = useState('');
  const [action, setAction] = useState(null), [message, setMessage] = useState('What can I help you add?'), [error, setError] = useState(''), [busy, setBusy] = useState(false), [typing, setTyping] = useState(false);
  const recognition = useRef(null), timeout = useRef(null), current = useRef(0), saving = useRef(false), active = useRef(true);
  const stop = () => { current.current++; if (timeout.current) clearTimeout(timeout.current); timeout.current = null; const rec = recognition.current; recognition.current = null; try { rec?.abort(); } catch {} setListening(false); };
  const silence = () => { try { window.speechSynthesis?.cancel(); } catch {} };
  const say = (words) => { setMessage(words); try { if (window.speechSynthesis && window.SpeechSynthesisUtterance) { silence(); window.speechSynthesis.speak(new window.SpeechSynthesisUtterance(words)); } } catch {} };
  useEffect(() => { const pause = () => { if (document.hidden) { stop(); silence(); } }; document.addEventListener('visibilitychange', pause); return () => { active.current = false; document.removeEventListener('visibilitychange', pause); current.current++; if (timeout.current) clearTimeout(timeout.current); try { recognition.current?.abort(); } catch {} silence(); }; }, []);
  useEffect(() => { if (hidden && open) { stop(); silence(); setOpen(false); } }, [hidden]);
  const close = () => { if (busy) return; stop(); silence(); setOpen(false); setError(''); setTranscript(''); setAction(null); setTyping(false); setMessage('What can I help you add?'); };
  const review = (heard) => { const result = parseVoiceQuickAdd(heard); setError(''); if (!result) { setAction(null); say('I can help add groceries or tasks. Try saying, “Add lemons to my grocery list.”'); return; } setAction(result); if (features[result.type === 'grocery' ? 'groceries' : 'tasks'] === false) { setError('This feature is turned off for your household.'); return; } say(result.type === 'grocery' ? `Should I add ${result.name} to your shopping list?` : `Should I add the task ${result.name}?`); };
  const save = async (item = action) => {
    if (saving.current || !item?.name?.trim() || features[item.type === 'grocery' ? 'groceries' : 'tasks'] === false) return;
    saving.current = true; setBusy(true); setError('');
    try { if (item.type === 'grocery') await addGrocery({ name: item.name.trim(), quantity: 1, unit: '' }); else await addTask({ title: item.name.trim(), assigneeIds: [] });
      if (active.current) { setAction(null); setTranscript(''); say(item.type === 'grocery' ? `Done. I added ${item.name} to your shopping list.` : `Done. I added ${item.name} to your tasks.`); }
    } catch { if (active.current) setError('I couldn’t save that. Your request is still here; please try again.'); } finally { saving.current = false; if (active.current) setBusy(false); }
  };
  const start = (mode = 'request') => {
    stop(); silence(); setError('');
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) { setError('Voice recognition isn’t available on this device. You can type instead.'); setTyping(true); return; }
    const id = ++current.current;
    try { const rec = new Ctor(); recognition.current = rec; rec.lang = navigator.language || 'en-US'; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = (event) => { if (id !== current.current) return; const heard = event.results?.[0]?.[0]?.transcript?.trim() || ''; stop(); if (mode === 'confirm') { const answer = parseVoiceConfirmation(heard); if (answer === 'yes') save(action); else if (answer === 'no') { setAction(null); say('Okay, I won’t add it.'); } else say('Please say yes or no, or use the buttons below.'); } else { setTranscript(heard); review(heard); } };
      rec.onerror = (event) => { if (id !== current.current) return; stop(); setError(event.error === 'not-allowed' ? 'Microphone permission was denied. You can type instead.' : event.error === 'no-speech' ? 'I didn’t hear anything. Try again or type instead.' : 'Voice recognition stopped. Try again or type instead.'); };
      rec.onend = () => { if (id !== current.current) return; if (timeout.current) clearTimeout(timeout.current); timeout.current = null; recognition.current = null; setListening(false); };
      rec.start(); setListening(true); timeout.current = setTimeout(() => { if (id === current.current) { stop(); setError('Listening timed out. Try again or type instead.'); } }, 15000);
    } catch { stop(); setError('Could not start the microphone. You can type instead.'); setTyping(true); }
  };
  if (hidden) return null;
  return <><button className="voice-quick-fab" type="button" onClick={() => setOpen(true)} aria-label="Voice quick add"><Mic size={21}/><span>Voice</span></button>
    <Modal open={open} onClose={close} title="Talk to FamOS" className="voice-quick-modal"><div className="voice-quick-content">
      <div className="voice-quick-conversation" aria-live="polite"><span className="voice-quick-orb"><Mic size={28}/></span><p className="voice-quick-prompt">{listening ? 'I’m listening…' : message}</p>{transcript && <p className="voice-quick-heard">You: “{transcript}”</p>}</div>
      {action ? <div className="voice-quick-review"><TextField label={action.type === 'grocery' ? 'Shopping item' : 'Task'} value={action.name} onChange={e => setAction({ ...action, name: e.target.value })} maxLength={120}/>{features[action.type === 'grocery' ? 'groceries' : 'tasks'] !== false && <><PrimaryButton disabled={busy || !action.name.trim()} onClick={() => save()}>{busy ? 'Adding…' : 'Yes, add it'}</PrimaryButton><SecondaryButton disabled={busy} onClick={() => listening ? stop() : start('confirm')}>{listening ? 'Stop listening' : 'Say yes or no'}</SecondaryButton></>}<SecondaryButton disabled={busy} onClick={() => { stop(); setAction(null); say('Okay, I won’t add it.'); }}>Cancel</SecondaryButton></div> : <button type="button" className={`voice-quick-listen ${listening ? 'is-listening' : ''}`} onClick={listening ? stop : () => start('request')} aria-pressed={listening}>{listening ? <><MicOff size={18}/> Stop listening</> : <><Mic size={18}/> Tap to speak</>}</button>}
      {error && <p role="alert" className="voice-quick-error">{error}</p>}
      {!action && <><button type="button" className="voice-quick-type" onClick={() => setTyping(!typing)}>{typing ? 'Hide typing' : 'Type instead'}</button>{typing && <><TextField label="Your request" value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Can you add lemons to my grocery list?"/><SecondaryButton disabled={listening || !transcript.trim()} onClick={() => review(transcript)}>Review request</SecondaryButton></>}</>}
      <p className="voice-quick-privacy">Your browser or device may send audio to its speech provider. FamOS doesn’t save audio. The microphone is on only while listening.</p>
    </div></Modal></>;
}
