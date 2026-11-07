import MiaVoiceOrb from './MiaVoiceOrb';
import { unlockMiaAudio } from '../lib/miaVoice';
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from './icons';
import { Modal, PrimaryButton, SecondaryButton, TextField } from './ui';
import { useFamily } from '../context/FamilyContext';
import { useAuth } from '../context/AuthContext';
import { parseVoiceQuickAdd, parseVoiceConfirmation, capitalizeFirstWord, resolveVoicePeriod, resolveVoiceFollowup, voiceEventQuestion } from '../lib/voiceQuickAdd';
import { invokeEdgeFunction } from '../lib/supabase';
import './voice-quick-add.css';

export default function VoiceQuickAdd({ features = {}, hidden = false }) {
  const { user } = useAuth();
  const { addGrocery, addTask, addEvent, addGoogleCalendarEvent, addGroceryList, addTaskList, setMealForSlot, groceryLists = [], taskLists = [], meals = [], googleConnected = false, googleCalendars = [], selectedGoogleCalendarIds = [], googleCalendarAliases = {}, famosCalendar } = useFamily();
  const [open, setOpen] = useState(false), [listening, setListening] = useState(false), [transcript, setTranscript] = useState('');
  const [action, setAction] = useState(null), [message, setMessage] = useState('Hi, I’m Mia. What can I help you add?'), [error, setError] = useState(''), [busy, setBusy] = useState(false), [typing, setTyping] = useState(false);
  const recognition = useRef(null), timeout = useRef(null), current = useRef(0), saving = useRef(false), active = useRef(true);
  const conversation = useRef([]), originalRequest = useRef(''), requestId = useRef(0);
  const [followup, setFollowup] = useState(''), [thinking, setThinking] = useState(false), [conversationMode, setConversationMode] = useState(false), [speaking, setSpeaking] = useState(false), [voiceRecovery, setVoiceRecovery] = useState(false);
  const [preparingVoice,setPreparingVoice] = useState(false);
  const aiAbort=useRef(null),speechAbort=useRef(null);
  const miaAudio=useRef(null), audioPlaying=useRef(false), audioCache=useRef(new Map()), listenStartTimer=useRef(null);
  const [startingMic,setStartingMic]=useState(false);
  const continuous = useRef(false), startRef = useRef(null), actionRef = useRef(null), speechGeneration = useRef(0), speechWatchdog = useRef(null);
  actionRef.current = action;
  const clearSpeechWatchdog = () => { if (speechWatchdog.current) clearTimeout(speechWatchdog.current); speechWatchdog.current = null; };
  const endConversation = () => { aiAbort.current?.abort(); setPreparingVoice(false); clearSpeechWatchdog(); setSpeaking(false); continuous.current = false; setConversationMode(false); requestId.current++; setThinking(false); speechGeneration.current++; stop(); silence(); };
  const stop = () => { current.current++; clearTimeout(listenStartTimer.current);setStartingMic(false); if (timeout.current) clearTimeout(timeout.current); timeout.current = null; const rec = recognition.current; recognition.current = null; try { rec?.abort(); } catch {} setListening(false); };
  const silence = () => { speechAbort.current?.abort();audioPlaying.current=false;try { window.speechSynthesis?.cancel(); miaAudio.current?.pause(); if(miaAudio.current){miaAudio.current.onended=null;miaAudio.current.onerror=null;miaAudio.current.removeAttribute?.('src');miaAudio.current.load?.();} } catch {} };
  const say = (words) => {
    stop();setMessage(words); setVoiceRecovery(false); clearSpeechWatchdog(); silence();
    const generation = ++speechGeneration.current;
    const resume = () => {
      if (generation !== speechGeneration.current) return;
      clearSpeechWatchdog();setPreparingVoice(false); setSpeaking(false);
      if (!continuous.current || !active.current || document.hidden) return;
      // Allow React to commit the reviewed action before choosing the next turn.
      setTimeout(() => {
        if (!continuous.current || generation !== speechGeneration.current || !active.current || document.hidden) return;
        const next = actionRef.current;
        const mode = next?.ambiguousTime ? 'period' : next && ((next.type === 'event' && !next.start) || (next.type === 'meal' && !next.date)) ? 'followup' : next ? 'confirm' : conversation.current.length ? 'followup' : 'request';
        startRef.current?.(mode);
      }, 350);
    };
    const failPlayback = () => {
      if (generation !== speechGeneration.current || !active.current) return;
      endConversation(); setVoiceRecovery(true);
      setError('Mia’s voice is unavailable right now. Tap “Hear Mia and continue” to retry.');
    };
    if(user?.id && miaAudio.current){
      setSpeaking(false);setPreparingVoice(true);
      let settled=false;
      const fallback=()=>{if(settled || generation!==speechGeneration.current || !active.current)return;settled=true;speechAbort.current?.abort();clearSpeechWatchdog();failPlayback();};
      speechWatchdog.current=setTimeout(fallback,12000);
      const text=words.slice(0,600);
      const cached=audioCache.current.get(text);speechAbort.current=new AbortController();
      (cached?Promise.resolve(cached):invokeEdgeFunction('mia-speech',{text},{signal:speechAbort.current.signal})).then(async data=>{
        if(settled || generation!==speechGeneration.current || !active.current)return;
        if(!data?.audio || !['audio/wav','audio/mpeg'].includes(data.mime)){fallback();return;}
        if(!cached){if(audioCache.current.size>=12)audioCache.current.delete(audioCache.current.keys().next().value);audioCache.current.set(text,data);}
        clearSpeechWatchdog();
        const audio=miaAudio.current;audio.src=`data:${data.mime};base64,${data.audio}`;
        audio.onended=()=>{audioPlaying.current=false;settled=true;resume();};audio.onerror=fallback;
        await audio.play();
        if(settled)return;
        if(generation!==speechGeneration.current || !active.current){audio.pause();return;}
        audioPlaying.current=true;setPreparingVoice(false);setSpeaking(true);
        speechWatchdog.current=setTimeout(fallback,60000);
      }).catch(fallback);
    }else failPlayback();
  };
  useEffect(() => { active.current = true; const pause = () => { if (document.hidden) { aiAbort.current?.abort(); clearSpeechWatchdog(); setSpeaking(false); continuous.current = false; setConversationMode(false); requestId.current++; setThinking(false); speechGeneration.current++; stop(); silence(); } }; document.addEventListener('visibilitychange', pause); return () => { active.current = false;aiAbort.current?.abort(); clearSpeechWatchdog(); continuous.current = false; speechGeneration.current++; document.removeEventListener('visibilitychange', pause); current.current++;clearTimeout(listenStartTimer.current); if (timeout.current) clearTimeout(timeout.current); try { recognition.current?.abort(); } catch {} silence(); }; }, []);
  useEffect(() => { if (hidden && open) { requestId.current++; conversation.current = []; originalRequest.current = ''; setThinking(false); endConversation(); setOpen(false); } }, [hidden]);
  const close = () => { if (busy) return; requestId.current++;audioCache.current.clear(); conversation.current = []; originalRequest.current = ''; setFollowup(''); setThinking(false); setVoiceRecovery(false); endConversation(); setOpen(false); setError(''); setTranscript(''); setAction(null); setTyping(false); setMessage('Hi, I’m Mia. What can I help you add?'); };
  const featureFor = type => ({ grocery: 'groceries', groceryList: 'groceries', task: 'tasks', taskList: 'tasks', event: 'calendar', meal: 'meals' })[type];
  const review = (heard) => { let result = parseVoiceQuickAdd(heard, { groceryLists, taskLists }); if (result?.type === 'event') result = { ...result, destination: 'family' }; setError(''); if (!result) { setAction(null); askAI(heard); return; } setAction(result); originalRequest.current = heard; if (features[featureFor(result.type)] === false) { if (continuous.current) endConversation(); setError('This feature is turned off for your household.'); return; } say(result.type === 'event' && !result.start ? voiceEventQuestion(result) : result.type === 'meal' && !result.date ? `What date should I plan ${result.name} for ${result.slot}?` : result.type === 'event' ? `Should I add ${result.name} to the family calendar${result.start ? ` starting ${new Date(result.start).toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}${result.recurrence !== 'none' ? `, repeating ${result.recurrence}` : ''}? ${result.ambiguousTime ? `I heard ${result.ambiguousTime.hour}:${String(result.ambiguousTime.minute).padStart(2,'0')}. Please choose AM or PM.` : result.assumedDuration ? 'I suggested one hour. Please check the end time.' : 'Please review the date and time.'}` : result.type === 'meal' ? `Should I plan ${result.name} for ${result.slot}? Please review the date${meals.some(m=>m.date===result.date && m.slot===result.slot && m.title) ? ' and note that this will replace the existing meal' : ''}.` : result.type === 'grocery' ? `Should I add ${result.name} to ${result.listName || 'your shopping list'}?` : result.type === 'task' ? `Should I add the task ${result.name}${result.listName ? ` to ${result.listName}` : ''}?` : `Should I create the list ${result.name}?`); };
  // The assistant may ask questions, but only the reviewed client action can save.
  const askAI = async (heard) => {
    if (!heard.trim()) return;
    const id = ++requestId.current;
    const turns = [...conversation.current, { role: 'user', content: heard.trim() }].slice(-8);
    conversation.current = turns;
    aiAbort.current?.abort();const controller=new AbortController();aiAbort.current=controller;const deadline=setTimeout(()=>controller.abort(),8000);
    setThinking(true); setError('');
    try {
      const response = await invokeEdgeFunction('fam-ai', { messages: turns, context: { screen: 'voice', localDate: new Date().toLocaleDateString('en-CA'), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } },{signal:controller.signal});
      if (!active.current || id !== requestId.current) return;
      const proposed = Array.isArray(response?.actions) ? response.actions : [];
      // AI output is never executed directly. Restrict conversion to explicit,
      // single-item additions; dates, lists, and other actions require the
      // existing parser/review flow instead of guessing.
      const first = proposed.length === 1 ? proposed[0] : null;
      const args = first?.args || {};
      const userText = turns.filter(t => t.role === 'user').map(t => t.content).join(' ');
      const explicit = /\b(add|put|create|make)\b/i.test(userText) && !/\b(delete|remove|buy|purchase|send)\b/i.test(userText);
      const name = String(first?.type === 'add_grocery' ? args.name || '' : args.title || '').trim();
      const exactName = name && name.length <= 120 && userText.toLocaleLowerCase().includes(name.toLocaleLowerCase());
      const defaultGrocery = /\b(?:grocery|shopping) list\b/i.test(userText) && !args.unit && (args.quantity == null || args.quantity === 1) && !/\b(?:two|three|four|five|half|dozen|\d+)\b/i.test(userText);
      const defaultTask = /\btask\b/i.test(userText) && !args.assignee_name && !args.due_date && !args.task_type;
      const candidate = explicit && exactName && first?.type === 'add_grocery' && defaultGrocery ? { type: 'grocery', name } : explicit && exactName && first?.type === 'add_task' && defaultTask ? { type: 'task', name } : null;
      if (candidate?.name && features[featureFor(candidate.type)] !== false && !response?.missing_fields?.length) {
        setAction(candidate);
        const prompt = candidate.type === 'grocery' ? `Should I add ${candidate.name} to your shopping list?` : `Should I add the task ${candidate.name}?`;
        conversation.current = [...turns, { role: 'assistant', content: prompt }]; say(prompt);
      } else {
        const prompt = proposed.length ? 'I can help with that, but I need a clearer request before preparing it. What would you like to add, and where?' : (typeof response?.message === 'string' && response.message.trim() ? response.message.trim().slice(0, 600) : 'Could you tell me a little more?');
        conversation.current = [...turns, { role: 'assistant', content: prompt }]; say(prompt);
      }
    } catch {
      if (active.current && id === requestId.current) { conversation.current=[]; say('The online assistant is unavailable. Please try again.'); }
    } finally { clearTimeout(deadline);if (active.current && id === requestId.current) setThinking(false); }
  };
  const continueConversation = (heard) => {
    if (!heard.trim()) return;
    setFollowup(''); setTranscript(heard);
    const direct=parseVoiceQuickAdd(heard,{groceryLists,taskLists});
    if(direct){review(heard);return;}
    if(action?.type==='event') {
      const resolved=resolveVoiceFollowup(action,heard);
      if(resolved){setAction({...resolved,destination:action.destination || 'family'});say(voiceEventQuestion(resolved) || `Please review ${resolved.name} on ${new Date(resolved.start).toLocaleString(undefined,{weekday:'long',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}. Should I add it?`);return;}
      say(voiceEventQuestion(action) || 'Please confirm when the details are correct, or tell me what to change.');return;
    }
    if (action?.type==='meal' && !action.date) {
      const combined = `${originalRequest.current} ${heard}`;
      const resolved = parseVoiceQuickAdd(combined, { groceryLists, taskLists });
      if (resolved?.date) { review(combined); return; }
      say('What day should I plan this meal?'); return;
    }
    if (action) { say('Please use the review fields to change the details, or confirm when they are correct.'); return; }
    askAI(heard);
  };
  const save = async (item = action) => {
    if (saving.current) return;
    if (item?.type === 'event' && item.destination !== 'family' && item.recurrence !== 'none') { setError('Repeating events currently need the FamOS family calendar. Choose that calendar or turn off repeat.'); return; }
    if (item?.type === 'event' && item.destination !== 'family' && (!googleConnected || !googleCalendars.some(c => c.id === item.destination && selectedGoogleCalendarIds.includes(c.id) && ['owner','writer'].includes(c.accessRole)))) { setError('That calendar is no longer available for editing. Choose another calendar.'); return; }
    if (!item?.name?.trim() || features[featureFor(item.type)] === false || (item.type === 'event' && (!item.start || !item.end || new Date(item.end) <= new Date(item.start))) || (item.type === 'meal' && !item.date)) { say('Please review and complete the details before adding.'); return; }
    if (continuous.current) { speechGeneration.current++; stop(); silence(); }
    saving.current = true; setBusy(true); setError('');
    try { if (item.type === 'grocery') await addGrocery({ name: item.name.trim(), quantity: 1, unit: '', ...(item.listId ? { listId: item.listId } : {}) }); else if (item.type === 'task') await addTask({ title: item.name.trim(), assigneeIds: [], ...(item.listId ? { listId: item.listId } : {}) }); else if (item.type === 'event') { const event = {title:capitalizeFirstWord(item.name),start:new Date(item.start).toISOString(),end:new Date(item.end).toISOString(),recurrence:item.recurrence,location:'',memberIds:[]}; if(item.destination === 'family') await addEvent(event); else await addGoogleCalendarEvent({...event,calendarId:item.destination}); } else if(item.type === 'meal') await setMealForSlot(item.date,item.slot,{title:item.name.trim(),notes:'',cookIds:[]}); else if(item.type === 'groceryList') await addGroceryList({name:item.name.trim()}); else if(item.type === 'taskList') await addTaskList({name:item.name.trim()}); else throw new Error('Unsupported action');
      if (active.current) { conversation.current = []; originalRequest.current = ''; setAction(null); setTranscript(''); say(item.type === 'grocery' ? `Done. I added ${item.name} to ${item.listName || 'your shopping list'}.` : item.type === 'task' ? `Done. I added ${item.name} to your tasks.` : item.type === 'event' ? `Done. I added ${capitalizeFirstWord(item.name)} to ${item.destination === 'family' ? (famosCalendar?.name || 'your family calendar') : (googleCalendarAliases[item.destination] || googleCalendars.find(c => c.id === item.destination)?.summary || 'your Google calendar')}.` : item.type === 'meal' ? `Done. I planned ${item.name} for ${item.slot}.` : `Done. I created the list ${item.name}.`); }
    } catch { if (continuous.current) endConversation(); if (active.current) setError('I couldn’t save that. Your request is still here; please try again.'); } finally { saving.current = false; if (active.current) setBusy(false); }
  };
  const start = (mode = 'request') => {
    stop(); setError('');
    // Do not reset a finished media element while Safari hands audio back to the microphone.
    if(audioPlaying.current){speechGeneration.current++;clearSpeechWatchdog();silence();setSpeaking(false);}
    if(user?.id && !miaAudio.current)miaAudio.current=unlockMiaAudio(miaAudio.current);
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) { if (continuous.current) endConversation(); setError('Voice recognition isn’t available on this device. You can type instead.'); setTyping(true); return; }
    const id = ++current.current;
    try { const rec = new Ctor(); recognition.current = rec; rec.lang = navigator.language || 'en-US'; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 3;
      rec.onstart=()=>{if(id!==current.current)return;clearTimeout(listenStartTimer.current);setStartingMic(false);setListening(true);};
      rec.onspeechend=()=>{if(id===current.current)try{rec.stop?.();}catch{}};
      rec.onresult = (event) => {
        if (id !== current.current) return;
        const results=Array.from(event.results || []);
        const final=results.filter(r=>r.isFinal!==false);
        if(!final.length){setTranscript(results.map(r=>r[0]?.transcript || '').join(' ').trim());return;}
        const alternatives=Array.from(final[0] || []);
        const best=alternatives.find(a=>parseVoiceQuickAdd(a.transcript,{groceryLists,taskLists})) || alternatives[0];
        const heard=(final.length===1?best?.transcript:final.map(r=>r[0]?.transcript || '').join(' '))?.trim() || '';
        stop();setTranscript(heard);
        if(!heard){say('I didn’t catch that. Please try again.');return;}
        if(parseVoiceQuickAdd(heard,{groceryLists,taskLists})){review(heard);return;}
        if(mode==='confirm'){
          const answer=parseVoiceConfirmation(heard);
          if(answer==='yes')save(actionRef.current);
          else if(answer==='no'){setAction(null);say('Okay, I won’t add it.');}
          else if(actionRef.current?.type==='event')continueConversation(heard);
          else say('Please say yes or no, or use the buttons below.');
        }else if(mode==='period' || mode==='followup')continueConversation(heard);
        else review(heard);
      };
      rec.onerror = (event) => { if (id !== current.current) return; if (continuous.current) endConversation(); else stop(); setError(event.error === 'not-allowed' ? 'Microphone permission was denied. You can type instead.' : event.error === 'no-speech' ? 'I didn’t hear anything. Try again or type instead.' : 'Voice recognition stopped. Try again or type instead.'); };
      rec.onend = () => { if (id !== current.current) return;clearTimeout(listenStartTimer.current);setStartingMic(false); if (timeout.current) clearTimeout(timeout.current); timeout.current = null; recognition.current = null; setListening(false); if (continuous.current) { endConversation(); setError('Listening stopped. Start the conversation again when you’re ready.'); } };
      setStartingMic(true);
      listenStartTimer.current=setTimeout(()=>{if(id!==current.current)return;endConversation();setError('The microphone didn’t start. Tap the microphone button to reconnect.');},3000);
      rec.start(); timeout.current = setTimeout(() => { if (id === current.current) { if (continuous.current) endConversation(); else stop(); setError('Listening timed out. Try again or type instead.'); } }, 15000);
    } catch { if (continuous.current) endConversation(); else stop(); setError('Could not start the microphone. You can type instead.'); setTyping(true); }
  };
  startRef.current = start;
  if (hidden) return null;
  const miaState = startingMic ? 'connecting' : listening ? 'listening' : speaking ? 'speaking' : thinking || preparingVoice ? 'thinking' : 'idle';
  const miaStateLabel = { idle: 'Your home assistant', connecting:'Connecting microphone…', listening: 'Listening…', speaking: 'Speaking…', thinking: 'Thinking…', live: 'Live conversation' }[miaState];
  return <><button data-mia-state={miaState} className="voice-quick-fab" type="button" onClick={() => setOpen(true)} aria-label="Talk to Mia, voice assistant" aria-haspopup="dialog" aria-expanded={open}>
      <span className="voice-quick-fab-avatar" aria-hidden="true"><MiaVoiceOrb animated/></span>
      <span className="mia-launcher-copy"><span>Talk to Mia</span><small>{miaStateLabel}</small></span>
      <span className="mia-voice-wave" aria-hidden="true"><i/><i/><i/><i/></span>
    </button>
    <Modal open={open} onClose={close} title="Talk to Mia" className="voice-quick-modal"><div className="voice-quick-content">
      <div className="voice-quick-conversation" data-mia-state={miaState} aria-live="polite"><span className="voice-quick-orb"><img src="/illustrations/mia-assistant.png" alt="" /></span><span className="voice-assistant-label"><span className="mia-status-dot" aria-hidden="true"/>Mia · {miaState === 'idle' ? 'FamOS AI assistant' : miaStateLabel}</span><p className="voice-quick-prompt">{listening && !action && !conversation.current.length ? 'I’m listening…' : message}</p>{transcript && <p className="voice-quick-heard">You: “{transcript}”</p>}</div>
      <button type="button" className="voice-conversation-toggle" aria-pressed={conversationMode} onClick={() => { if (conversationMode) endConversation(); else { setVoiceRecovery(false); continuous.current = true; setConversationMode(true);  start(actionRef.current?.ambiguousTime ? 'period' : actionRef.current ? ((actionRef.current.type === 'event' && !actionRef.current.start) || (actionRef.current.type === 'meal' && !actionRef.current.date) ? 'followup' : 'confirm') : conversation.current.length ? 'followup' : 'request'); } }}>{conversationMode ? 'End conversation' : 'Start continuous conversation'}</button>
      {conversationMode && <p className="voice-conversation-status">{startingMic ? 'Connecting microphone…' : listening ? 'Listening for your reply' : thinking ? 'Thinking…' : preparingVoice ? 'Preparing Mia’s voice…' : speaking ? 'Mia is speaking…' : 'Getting ready to listen…'}</p>}
      {voiceRecovery && <button type="button" className="voice-quick-listen" onClick={() => { if(user?.id)miaAudio.current=unlockMiaAudio(miaAudio.current); setError(''); setVoiceRecovery(false); continuous.current = true; setConversationMode(true); say(message); }}>Hear Mia and continue</button>}
      {action ? <div className="voice-quick-review"><TextField label={action.type === 'grocery' ? 'Shopping item' : action.type === 'task' ? 'Task' : action.type === 'event' ? 'Event' : action.type === 'meal' ? 'Meal' : 'List name'} value={action.name} onChange={e => setAction({ ...action, name: e.target.value })} maxLength={120}/>{action.listName && <p>Adding to: {action.listName}</p>}{action.type === 'event' && <>{action.ambiguousTime ? <div className="voice-quick-ambiguous"><label>Event date<input aria-label="Event date" type="date" value={action.ambiguousTime.date} onChange={e=>setAction({...action,ambiguousTime:{...action.ambiguousTime,date:e.target.value}})}/></label><fieldset><legend>Is {action.ambiguousTime.hour}:{String(action.ambiguousTime.minute).padStart(2,'0')} AM or PM?</legend><div className="voice-period-options"><button type="button" onClick={()=>setAction(resolveVoicePeriod(action,'am'))}>AM</button><button type="button" onClick={()=>setAction(resolveVoicePeriod(action,'pm'))}>PM</button></div>{!conversationMode && <button type="button" className="voice-period-speak" onClick={()=>listening ? stop() : start('period')}>{listening ? 'Stop listening' : 'Say AM or PM'}</button>}</fieldset></div> : <><label>Start<input aria-label="Start" type="datetime-local" value={action.start} onChange={e=>setAction({...action,start:e.target.value})}/></label><label>End<input aria-label="End" type="datetime-local" value={action.end} onChange={e=>setAction({...action,end:e.target.value,assumedDuration:false})}/></label></>}<label>Repeat<select aria-label="Repeat" value={action.recurrence} onChange={e=>setAction({...action,recurrence:e.target.value})}><option value="none">Does not repeat</option><option value="daily">Every day</option><option value="weekly">Every week</option><option value="monthly">Every month</option><option value="yearly">Every year</option></select></label>{action.assumedDuration && <p>One hour suggested; please check the end time.</p>}<label>Calendar<select aria-label="Calendar" value={action.destination} onChange={e=>setAction({...action,destination:e.target.value})}><option value="family">{famosCalendar?.name || 'FamOS family calendar'}</option>{googleConnected && googleCalendars.filter(c=>selectedGoogleCalendarIds.includes(c.id) && ['owner','writer'].includes(c.accessRole)).map(c=><option key={c.id} value={c.id}>{googleCalendarAliases[c.id] || c.summary || 'Google Calendar'}</option>)}</select></label>{action.destination !== 'family' && action.recurrence !== 'none' && <p role="alert">Repeating events currently need the FamOS family calendar. Choose that calendar or turn off repeat.</p>}</>}{action.type === 'meal' && <><label>Meal date<input aria-label="Meal date" type="date" value={action.date} onChange={e=>setAction({...action,date:e.target.value})}/></label><label>Meal<select aria-label="Meal" value={action.slot} onChange={e=>setAction({...action,slot:e.target.value})}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option></select></label>{meals.some(m=>m.date===action.date && m.slot===action.slot && m.title) && <p>This will replace the meal already planned for this slot.</p>}</>}{features[featureFor(action.type)] !== false && <><PrimaryButton disabled={busy || !action.name.trim() || (action.type === 'event' && (!action.start || !action.end || new Date(action.end) <= new Date(action.start))) || (action.type === 'meal' && !action.date) || (action.type === 'event' && action.destination !== 'family' && action.recurrence !== 'none')} onClick={() => save()}>{busy ? 'Adding…' : 'Yes, add it'}</PrimaryButton>{!conversationMode && <SecondaryButton disabled={busy} onClick={() => listening ? stop() : start('confirm')}>{listening ? 'Stop listening' : 'Say yes or no'}</SecondaryButton>}</>}<SecondaryButton disabled={busy} onClick={() => { stop(); setAction(null); say('Okay, I won’t add it.'); }}>Cancel</SecondaryButton></div> : !conversationMode && <button type="button" className={`voice-quick-listen ${listening ? 'is-listening' : ''}`} onClick={listening ? stop : () => start('request')} aria-pressed={listening}>{listening ? <><MicOff size={18}/> Stop listening</> : <><Mic size={18}/> Tap to speak</>}</button>}
      {thinking && <p role="status">Thinking…</p>}
      <p className="mia-natural-voice">AI-generated voice</p>
      {!conversationMode && action && !action.ambiguousTime && ((action.type === 'event' && !action.start) || (action.type === 'meal' && !action.date)) && <button type="button" className="voice-quick-type" disabled={thinking} onClick={() => listening ? stop() : start('followup')}>{listening ? 'Stop listening' : 'Say the missing details'}</button>}
      {!conversationMode && !action && conversation.current.length > 0 && <button type="button" className="voice-quick-type" disabled={thinking} onClick={() => listening ? stop() : start('followup')}>{listening ? 'Stop listening' : 'Reply by voice'}</button>}
      {error && <p role="alert" className="voice-quick-error">{error}</p>}
      {action && !action.ambiguousTime && ((action.type === 'event' && !action.start) || (action.type === 'meal' && !action.date)) && <><TextField label="Your reply" value={followup} onChange={e => setFollowup(e.target.value)} placeholder="e.g. tomorrow at 3 PM"/><SecondaryButton disabled={!followup.trim() || thinking} onClick={() => continueConversation(followup)}>Send reply</SecondaryButton></>}
      {!action && <><button type="button" className="voice-quick-type" onClick={() => setTyping(!typing)}>{typing ? 'Hide typing' : 'Type instead'}</button>{typing && <><TextField label="Your request" value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Can you add lemons to my grocery list?"/><SecondaryButton disabled={listening || !transcript.trim()} onClick={() => conversation.current.length ? continueConversation(transcript) : review(transcript)}>Review request</SecondaryButton></>}</>}
      <p className="voice-quick-privacy">In continuous conversation, the microphone resumes after each response until you end it, the app is backgrounded, or listening times out. Your speech is processed to understand your request and generate a reply. FamOS doesn’t save audio. The microphone is on only while listening. Mia uses an AI-generated voice.</p>
    </div></Modal></>;
}
