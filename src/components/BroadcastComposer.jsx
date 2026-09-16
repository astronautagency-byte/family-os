import BroadcastVoice from './BroadcastVoice';
import {useState} from 'react';
import {Megaphone} from './icons';
import {supabase} from '../lib/supabase';
import './broadcast-composer.css';

export default function BroadcastComposer({mode,onModeChange,text,onTextChange,voice,onVoiceChange,recording,onRecordingChange,sending,onSubmit,placeholder,onFocus,onBlur,voiceText='',onVoiceTextChange=()=>{}}) {
 const [transcribing,setTranscribing]=useState(false),[error,setError]=useState('');
 const ready=!recording && !sending && !transcribing && (mode==='text' ? !!text.trim() : !!voice);
 async function transcribe(){
  setTranscribing(true);setError('');
  try{
   const body=new FormData();body.append('file',voice,`voice.${voice.type.includes('mp4')?'mp4':voice.type.includes('ogg')?'ogg':'webm'}`);
   const result=await supabase.functions.invoke('transcribe-broadcast',{body});
   if(result.error){let message='Could not transcribe. Retry or type the text below.';try{message=(await result.error.context.json()).error||message;}catch{}throw Error(message);}
   if(result.data?.error)throw Error(result.data.error);
   onVoiceTextChange(result.data.text||'');
  }catch(error){setError(error.message);}finally{setTranscribing(false);}
 }
 return <div className="family-broadcast-composer">
  <div className="broadcast-mode-picker" role="group" aria-label="Broadcast format">
   {['text','voice'].map(value=><button key={value} type="button" aria-pressed={mode===value} disabled={sending||recording||transcribing} onClick={()=>onModeChange(value)}>{value==='text'?'Text broadcast':'Voice note'}</button>)}
  </div>
  <p className="broadcast-audience">Share with your household. Tap Record to start a voice note. Text is optional.</p>
  <form onSubmit={onSubmit}>
   <div className="broadcast-compact-row"><Megaphone size={22} aria-hidden="true"/>
   {mode==='text' ? <input aria-label="Broadcast a message to the family" placeholder={placeholder} value={text} onChange={e=>onTextChange(e.target.value)} onFocus={onFocus} onBlur={onBlur} maxLength={4000} disabled={sending}/>:<span>{voice?'Voice note attached':recording?'Recording your voice note…':'Record a message for your household'}</span>}
   <button type="submit" className="broadcast-send-button" disabled={!ready}>{sending?'Sending…':mode==='voice'?'Send voice note':'Send text broadcast'}</button>
   </div>
   <div hidden={mode!=='voice'}><BroadcastVoice value={voice} onChange={value=>{onVoiceChange(value);onVoiceTextChange('');setError('');}} disabled={sending||transcribing} onRecordingChange={onRecordingChange}/>
   {voice && <details className="broadcast-transcript"><summary>Add text (optional)</summary><p>You can send the recording without text. Automatic transcription is not currently configured; you can type a caption below.</p><textarea aria-label="Voice note text" placeholder="Optional text recipients will see on Home" maxLength={4000} value={voiceText} onChange={e=>onVoiceTextChange(e.target.value)} disabled={sending||transcribing}/>{error&&<p role="alert">{error}</p>}</details>}
   </div>
  </form>
 </div>;
}
