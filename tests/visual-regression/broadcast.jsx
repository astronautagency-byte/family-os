import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import BroadcastComposer from '../../src/components/BroadcastComposer';
import '../../src/index.css';
function Preview(){
 const [mode,onModeChange]=useState('text'),[text,onTextChange]=useState(''),[voice,onVoiceChange]=useState(null),[recording,onRecordingChange]=useState(false),[voiceText,onVoiceTextChange]=useState(''),[sent,setSent]=useState('');
 return <main style={{maxWidth:800,margin:'24px auto',padding:16}}><p>Local preview · sends stay on this page</p><BroadcastComposer {...{mode,onModeChange,text,onTextChange,voice,onVoiceChange,recording,onRecordingChange,voiceText,onVoiceTextChange}} placeholder="Tell your family…" onSubmit={e=>{e.preventDefault();setSent(mode==='text'?text:voiceText);}}/><p role="status">{sent}</p></main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
