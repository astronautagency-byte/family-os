import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from './icons';
import { Modal, PrimaryButton, SecondaryButton, TextField } from './ui';
import { useFamily } from '../context/FamilyContext';
import { parseVoiceQuickAdd } from '../lib/voiceQuickAdd';
import './voice-quick-add.css';

export default function VoiceQuickAdd({features={}, hidden=false}) {
  const { addGrocery, addTask } = useFamily();
  const [open,setOpen]=useState(false), [listening,setListening]=useState(false), [transcript,setTranscript]=useState(''), [type,setType]=useState(''), [name,setName]=useState(''), [error,setError]=useState(''), [busy,setBusy]=useState(false), [done,setDone]=useState('');
  const recognition=useRef(null), timeout=useRef(null), current=useRef(0), saving=useRef(false);
  const stop=()=>{current.current++; if(timeout.current)clearTimeout(timeout.current);timeout.current=null;const rec=recognition.current;recognition.current=null;try{rec?.abort()}catch{}setListening(false)};
  useEffect(()=>{const pause=()=>{if(document.hidden)stop()};document.addEventListener('visibilitychange',pause);return()=>{document.removeEventListener('visibilitychange',pause);current.current++;if(timeout.current)clearTimeout(timeout.current);try{recognition.current?.abort()}catch{}recognition.current=null}},[]);
  useEffect(()=>{if(hidden&&open){stop();setOpen(false)}},[hidden]);
  const close=()=>{if(busy)return;stop();setOpen(false);setError('');setDone('');setTranscript('');setType('');setName('')};
  const start=()=>{
    stop();setError('');setDone('');setTranscript('');setType('');setName('');
    const Ctor=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Ctor){setError('Voice recognition is not available on this device. Type a request below.');return}
    const id=++current.current;
    try {
      const rec=new Ctor();recognition.current=rec;rec.lang=navigator.language||'en-US';rec.continuous=false;rec.interimResults=false;rec.maxAlternatives=1;
      rec.onresult=(event)=>{if(id!==current.current)return;const heard=event.results?.[0]?.[0]?.transcript?.trim()||'';stop();setTranscript(heard);const result=parseVoiceQuickAdd(heard);if(result){setType(result.type);setName(result.name)}else setError('We couldn’t identify that request. Edit it or choose an action below.');};
      rec.onerror=(event)=>{if(id!==current.current)return;stop();setError(event.error==='not-allowed'?'Microphone permission was denied. You can type instead.':event.error==='no-speech'?'No speech heard. Try again or type instead.':'Voice recognition stopped. Try again or type instead.');};
      rec.onend=()=>{if(id!==current.current)return;if(timeout.current)clearTimeout(timeout.current);timeout.current=null;recognition.current=null;setListening(false)};
      rec.start();setListening(true);timeout.current=setTimeout(()=>{if(id===current.current){stop();setError('Listening timed out. Try again or type instead.')}},15000);
    } catch {stop();setError('Could not start the microphone. You can type instead.')}
  };
  const interpret=()=>{const result=parseVoiceQuickAdd(transcript);if(result){setType(result.type);setName(result.name);setError('')}else setError('Try “add lemons to my grocery list” or “add task call the dentist”.')};
  const save=async()=>{if(saving.current||!name.trim()||!type||features[type==='grocery'?'groceries':'tasks']===false)return;saving.current=true;setBusy(true);setError('');try{if(type==='grocery')await addGrocery({name:name.trim(),quantity:1,unit:''});else await addTask({title:name.trim(),assigneeIds:[]});setDone(type==='grocery'?'Added to your shopping list.':'Task added.');setName('');setType('');setTranscript('')}catch{setError('Could not save that. Your request is still here; please try again.')}finally{saving.current=false;setBusy(false)}};
  if(hidden)return null;
  return <><button className="voice-quick-fab" type="button" onClick={()=>setOpen(true)} aria-label="Voice quick add"><Mic size={21}/><span>Voice</span></button><Modal open={open} onClose={close} title="Voice quick add" className="voice-quick-modal"><div className="voice-quick-content"><p>Tap to speak, then review before adding a grocery or task.</p><p className="voice-quick-privacy">Your browser or device may send audio to its speech provider. FamOS does not save audio from this feature. You can type instead.</p><button type="button" className={`voice-quick-listen ${listening?'is-listening':''}`} onClick={listening?stop:start} aria-pressed={listening}>{listening?<><MicOff size={17}/> Stop listening</>:<><Mic size={17}/> Tap to speak</>}</button>{listening&&<p role="status" className="voice-quick-status">Listening… microphone is active.</p>}<TextField label="What you said" value={transcript} onChange={e=>{setTranscript(e.target.value);setType('');setName('');setDone('')}} placeholder="Add lemons to my grocery list"/><SecondaryButton onClick={interpret} disabled={listening||!transcript.trim()}>Review request</SecondaryButton>{type&&<div className="voice-quick-review"><strong>{type==='grocery'?'Add to shopping':'Add a task'}</strong><TextField label={type==='grocery'?'Item':'Task'} value={name} onChange={e=>setName(e.target.value)} maxLength={120}/>{features[type==='grocery'?'groceries':'tasks']===false?<p role="alert">This feature is turned off for your household.</p>:<PrimaryButton disabled={busy||!name.trim()} onClick={save}>{busy?'Saving…':type==='grocery'?'Add to shopping':'Add task'}</PrimaryButton>}</div>}{error&&<p role="alert" className="voice-quick-error">{error}</p>}{done&&<p role="status" className="voice-quick-success">{done}</p>}</div></Modal></>;
}
