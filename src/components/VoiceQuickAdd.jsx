import AiPrivacyGate from './AiPrivacyGate';
import { createPortal } from 'react-dom';
import { unlockMiaAudio } from '../lib/miaVoice';
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from './icons';
import { Modal, PrimaryButton, SecondaryButton, TextField } from './ui';
import { useFamily } from '../context/FamilyContext';
import { useAuth } from '../context/AuthContext';
import { parseVoiceQuickAdd, prepareMiaVoiceAction, parseVoiceConfirmation, capitalizeFirstWord, resolveVoicePeriod, resolveVoiceFollowup, voiceEventQuestion } from '../lib/voiceQuickAdd';
import { invokeEdgeFunction } from '../lib/supabase';
import './voice-quick-add.css';

export default function VoiceQuickAdd({ features = {}, hidden = false }) {
  const { user } = useAuth();
  const { addGrocery, addTask, addEvent, addGoogleCalendarEvent, addGroceryList, addTaskList, setMealForSlot, groceryLists = [], taskLists = [], meals = [], googleConnected = false, googleCalendars = [], selectedGoogleCalendarIds = [], googleCalendarAliases = {}, famosCalendar } = useFamily();
  const [open, setOpen] = useState(false), [listening, setListening] = useState(false), [transcript, setTranscript] = useState('');
  const [action, setAction] = useState(null), [message, setMessage] = useState('Hi, I’m Mia. What can I help you add?'), [error, setError] = useState(''), [busy, setBusy] = useState(false), [typing, setTyping] = useState(false);
  const [launcherTarget,setLauncherTarget]=useState(null);
  useEffect(()=>{setLauncherTarget(document.getElementById('mia-launcher-slot'));},[]);
  const silentRestarts=useRef(0);
  const recognition = useRef(null), timeout = useRef(null), current = useRef(0), saving = useRef(false), active = useRef(true);
  const panelGeneration = useRef(0);
  const conversation = useRef([]), originalRequest = useRef(''), requestId = useRef(0);
  const [followup, setFollowup] = useState(''), [thinking, setThinking] = useState(false), [conversationMode, setConversationMode] = useState(false), [speaking, setSpeaking] = useState(false), [voiceRecovery, setVoiceRecovery] = useState(false);
  const [preparingVoice,setPreparingVoice] = useState(false);
  const aiAbort=useRef(null),speechAbort=useRef(null);
  const miaAudio=useRef(null), audioCache=useRef(new Map()), listenStartTimer=useRef(null);
  const [startingMic,setStartingMic]=useState(false);
  const continuous = useRef(false), startRef = useRef(null), actionRef = useRef(null), speechGeneration = useRef(0), speechWatchdog = useRef(null);
  actionRef.current = action;
  const clearSpeechWatchdog = () => { if (speechWatchdog.current) clearTimeout(speechWatchdog.current); speechWatchdog.current = null; };
  const endConversation = () => { aiAbort.current?.abort(); setPreparingVoice(false); clearSpeechWatchdog(); setSpeaking(false); continuous.current = false; setConversationMode(false); requestId.current++; setThinking(false); speechGeneration.current++; stop(); silence(); };
  const stop = () => { current.current++; clearTimeout(listenStartTimer.current);setStartingMic(false); if (timeout.current) clearTimeout(timeout.current); timeout.current = null; const rec = recognition.current; recognition.current = null; try { rec?.abort(); } catch {} setListening(false); };
  const silence = () => {
    speechAbort.current?.abort();
    const audio = miaAudio.current;
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
  };

  const nextMode = () => {
    const draft = actionRef.current;
    if (!draft) return conversation.current.length ? 'followup' : 'request';
    if (draft.ambiguousTime) return 'period';
    if ((draft.type === 'event' && !draft.start) || (draft.type === 'meal' && !draft.date)) return 'followup';
    return 'confirm';
  };

  const say = (words) => {
    stop();
    setMessage(words);
    setVoiceRecovery(false);
    clearSpeechWatchdog();
    const generation = ++speechGeneration.current;
    silence();
    if (!continuous.current) return;

    const audio = miaAudio.current;
    let settled = false;
    const isCurrent = () => !settled && generation === speechGeneration.current && active.current;
    const finish = (audioUnavailable = false) => {
      if (!isCurrent()) return;
      settled = true;
      clearSpeechWatchdog();
      if (audioUnavailable) silence();
      setPreparingVoice(false);
      setSpeaking(false);
      setVoiceRecovery(audioUnavailable);
      listenStartTimer.current = setTimeout(() => {
        if (generation === speechGeneration.current && continuous.current && active.current && !document.hidden) {
          startRef.current?.(false, true);
        }
      }, 300);
    };

    if (!user?.id || !audio) {
      finish(true);
      return;
    }

    setPreparingVoice(true);
    const controller = new AbortController();
    speechAbort.current = controller;
    // Covers both synthesis and play(). Safari can leave play() pending.
    speechWatchdog.current = setTimeout(() => finish(true), 6000);
    const text = words.slice(0, 600);
    const cached = audioCache.current.get(text);
    const reply = cached ? Promise.resolve(cached) : invokeEdgeFunction('mia-speech', { text }, { signal: controller.signal });
    reply.then(async data => {
      if (!isCurrent()) return;
      if (!data?.audio || !['audio/wav', 'audio/mpeg'].includes(data.mime)) {
        finish(true);
        return;
      }
      if (!cached) {
        if (audioCache.current.size >= 12) audioCache.current.delete(audioCache.current.keys().next().value);
        audioCache.current.set(text, data);
      }
      audio.onended = () => finish();
      audio.onerror = () => finish(true);
      audio.src = `data:${data.mime};base64,${data.audio}`;
      await audio.play();
      if (!isCurrent()) return;
      clearSpeechWatchdog();
      setPreparingVoice(false);
      setSpeaking(true);
      speechWatchdog.current = setTimeout(() => finish(true), 40000);
    }).catch(() => finish(true));
  };
  useEffect(() => { active.current = true; const pause = () => { if (document.hidden) { aiAbort.current?.abort(); clearSpeechWatchdog(); setSpeaking(false); continuous.current = false; setConversationMode(false); requestId.current++; setThinking(false); speechGeneration.current++; stop(); silence(); } }; document.addEventListener('visibilitychange', pause); return () => { active.current = false;aiAbort.current?.abort(); clearSpeechWatchdog(); continuous.current = false; speechGeneration.current++; document.removeEventListener('visibilitychange', pause); current.current++;clearTimeout(listenStartTimer.current); if (timeout.current) clearTimeout(timeout.current); try { recognition.current?.abort(); } catch {} silence(); }; }, []);
  useEffect(() => { if (hidden && open) { panelGeneration.current++; requestId.current++; conversation.current = []; originalRequest.current = ''; setThinking(false); endConversation(); setOpen(false); } }, [hidden]);
  const close = () => { panelGeneration.current++; requestId.current++;audioCache.current.clear(); conversation.current = []; originalRequest.current = ''; setFollowup(''); setThinking(false); setVoiceRecovery(false); endConversation(); setOpen(false); setError(''); setTranscript(''); setAction(null); setTyping(false); setMessage('Hi, I’m Mia. What can I help you add?'); };
  const featureFor = type => ({ grocery: 'groceries', groceryList: 'groceries', task: 'tasks', taskList: 'tasks', event: 'calendar', meal: 'meals' })[type];
  const review = (heard) => { let result = parseVoiceQuickAdd(heard, { groceryLists, taskLists }); if (result?.type === 'event') result = { ...result, destination: 'family' }; setError(''); if (!result) { setAction(null); askAI(heard); return; } setAction(result); originalRequest.current = heard; if (features[featureFor(result.type)] === false) { if (continuous.current) endConversation(); setError('This feature is turned off for your household.'); return; } say(result.type === 'event' && !result.start ? voiceEventQuestion(result) : result.type === 'meal' && !result.date ? `What date should I plan ${result.name} for ${result.slot}?` : result.type === 'event' ? `Should I add ${result.name} to the family calendar${result.start ? ` starting ${new Date(result.start).toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}${result.recurrence !== 'none' ? `, repeating ${result.recurrence}` : ''}? ${result.ambiguousTime ? `I heard ${result.ambiguousTime.hour}:${String(result.ambiguousTime.minute).padStart(2,'0')}. Please choose AM or PM.` : result.assumedDuration ? 'I suggested one hour. Please check the end time.' : 'Please review the date and time.'}` : result.type === 'meal' ? `Should I plan ${result.name} for ${result.slot}? Please review the date${meals.some(m=>m.date===result.date && m.slot===result.slot && m.title) ? ' and note that this will replace the existing meal' : ''}.` : result.type === 'grocery' ? `Should I add ${result.name} to ${result.listName || 'your shopping list'}?` : result.type === 'task' ? `Should I add the task ${result.name}${result.listName ? ` to ${result.listName}` : ''}?` : `Should I create the list ${result.name}?`); };
  // The assistant may ask questions, but only the reviewed client action can save.
  const askAI = async (heard) => {
    if (!heard.trim()) return;
    const id = ++requestId.current;
    const turns = [...conversation.current, { role: 'user', content: heard.trim() }].slice(-8);
    conversation.current = turns;
    aiAbort.current?.abort();const controller=new AbortController();aiAbort.current=controller;const deadline=setTimeout(()=>controller.abort(),20000);
    setThinking(true); setError('');
    try {
      const response = await invokeEdgeFunction('fam-ai', { messages: turns, context: { screen: 'voice', localDate: new Date().toLocaleDateString('en-CA'), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } },{signal:controller.signal});
      if (!active.current || id !== requestId.current) return;
      const proposed = Array.isArray(response?.actions) ? response.actions : [];
      const lastRequest=turns.filter(t=>t.role==='user').at(-1)?.content || '';
      const candidate=prepareMiaVoiceAction(proposed,lastRequest,{groceryLists,taskLists});
      if (candidate?.name && features[featureFor(candidate.type)] !== false && !response?.missing_fields?.length) {
        setAction(candidate);
        const prompt = candidate.type === 'grocery' ? `Should I add ${candidate.quantity} ${candidate.unit ? candidate.unit+' ' : ''}${candidate.name} to your shopping list?` : candidate.type === 'meal' ? `Should I plan ${candidate.name} for ${candidate.slot} on ${candidate.date}? Please review the meal plan below.` : candidate.type === 'event' ? voiceEventQuestion(candidate) || `Should I add ${candidate.name}? Please review the date and time below.` : `Should I add the task ${candidate.name}${candidate.due ? ' due '+candidate.due : ''}?`;
        conversation.current = [...turns, { role: 'assistant', content: prompt }]; say(prompt);
      } else {
        const reply=typeof response?.message==='string' ? response.message.trim().slice(0,500) : '';
        const claimsSave=/\b(?:added|saved|created|scheduled|updated|deleted|booked|sent)\b/i.test(reply);
        const prompt = proposed.length ? 'I haven’t saved anything; I need a clearer request. I can review one grocery, meal, task or family event at a time here. For assignments, other changes or a larger plan, use the app. What would you like to add first?' : claimsSave ? 'Nothing has been saved. I can prepare groceries, meals, tasks and family events for your review. What would you like to add?' : reply || 'Could you tell me a little more?';
        conversation.current = [...turns, { role: 'assistant', content: prompt }]; say(prompt);
      }
    } catch {
      if (active.current && id === requestId.current) { conversation.current=[]; say('The online assistant is unavailable. Please try again.'); }
    } finally { clearTimeout(deadline);if (active.current && id === requestId.current) setThinking(false); }
  };
  const continueConversation = (heard) => {
    if (!heard.trim()) return;
    setFollowup(''); setTranscript(heard); setError('');
    const direct=parseVoiceQuickAdd(heard,{groceryLists,taskLists});
    if(direct){review(heard);return;}
    if (action && parseVoiceConfirmation(heard) === 'yes') { save(action); return; }
    if (action && parseVoiceConfirmation(heard) === 'no') { setAction(null); say('Okay, I won’t add it.'); return; }
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
    if (!item?.name?.trim() || (item.type==='grocery' && item.quantity!=null && (!Number.isFinite(item.quantity)||item.quantity<=0)) || features[featureFor(item.type)] === false || (item.type === 'event' && (!item.start || !item.end || new Date(item.end) <= new Date(item.start))) || (item.type === 'meal' && !item.date)) { say('Please review and complete the details before adding.'); return; }
    if (continuous.current) { speechGeneration.current++; clearSpeechWatchdog(); setPreparingVoice(false); setSpeaking(false); stop(); silence(); }
    const saveRequest = panelGeneration.current;
    saving.current = true; setBusy(true); setError('');
    try { if (item.type === 'grocery') await addGrocery({ name: item.name.trim(), quantity: item.quantity || 1, unit: item.unit || '', ...(item.listId ? { listId: item.listId } : {}) }); else if (item.type === 'task') await addTask({ title: item.name.trim(), assigneeIds: [], ...(item.due ? {due:item.due} : {}), ...(item.listId ? { listId: item.listId } : {}) }); else if (item.type === 'event') { const event = {title:capitalizeFirstWord(item.name),start:new Date(item.start).toISOString(),end:new Date(item.end).toISOString(),recurrence:item.recurrence,location:item.location || '',memberIds:[]}; if(item.destination === 'family') await addEvent(event); else await addGoogleCalendarEvent({...event,calendarId:item.destination}); } else if(item.type === 'meal') await setMealForSlot(item.date,item.slot,{title:item.name.trim(),notes:item.notes || '',cookIds:[]}); else if(item.type === 'groceryList') await addGroceryList({name:item.name.trim()}); else if(item.type === 'taskList') await addTaskList({name:item.name.trim()}); else throw new Error('Unsupported action');
      if (active.current && saveRequest === panelGeneration.current) { conversation.current = []; originalRequest.current = ''; setAction(null); setTranscript(''); say(item.type === 'grocery' ? `Done. I added ${item.name} to ${item.listName || 'your shopping list'}.` : item.type === 'task' ? `Done. I added ${item.name} to your tasks.` : item.type === 'event' ? `Done. I added ${capitalizeFirstWord(item.name)} to ${item.destination === 'family' ? (famosCalendar?.name || 'your family calendar') : (googleCalendarAliases[item.destination] || googleCalendars.find(c => c.id === item.destination)?.summary || 'your Google calendar')}.` : item.type === 'meal' ? `Done. I planned ${item.name} for ${item.slot}.` : `Done. I created the list ${item.name}.`); }
    } catch { if (active.current && saveRequest === panelGeneration.current) { if (continuous.current) endConversation(); setError('I couldn’t save that. Your request is still here; please try again.'); } } finally { saving.current = false; if (active.current) setBusy(false); }
  };
  const start = (retry = false, resumed = false) => {
    stop(); setError('');
    if(!retry)silentRestarts.current=0;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) { if (continuous.current) endConversation(); setError('Voice recognition isn’t available on this device. You can type instead.'); setTyping(true); return; }
    const id = ++current.current;
    const idleLimit=30000;
    const resetIdle=()=>{clearTimeout(timeout.current);timeout.current=setTimeout(()=>{if(id!==current.current)return;endConversation();setError('Mia paused after a quiet moment. Tap Start talking to resume.');},idleLimit);};
    const retryRecognition = () => {
      if (!continuous.current || silentRestarts.current >= 2 || document.hidden) return false;
      silentRestarts.current++;
      stop();
      setStartingMic(true);
      listenStartTimer.current = setTimeout(() => {
        if (continuous.current && active.current && !document.hidden) startRef.current?.(true, true);
      }, 400);
      return true;
    };
    const recoverSilence = () => {
      if (retryRecognition()) return;
      endConversation();
      setError('Mia paused after a quiet moment. Tap Start talking to resume.');
    };
    const microphoneUnavailable = () => {
      if (resumed && retryRecognition()) return;
      endConversation();
      setError('The microphone didn’t start. Tap Start talking to reconnect.');
    };
    try { const rec = new Ctor(); recognition.current = rec; rec.lang = navigator.language || 'en-US'; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 3;
      rec.onstart=()=>{if(id!==current.current)return;clearTimeout(listenStartTimer.current);setStartingMic(false);setListening(true);resetIdle();};
      rec.onresult = (event) => {
        if (id !== current.current) return;
        silentRestarts.current=0;resetIdle();
        const results=Array.from(event.results || []);
        const final=results.filter(r=>r.isFinal!==false);
        if(!final.length){setTranscript(results.map(r=>r[0]?.transcript || '').join(' ').trim());return;}
        const alternatives=Array.from(final[0] || []);
        const best=alternatives.find(a=>parseVoiceQuickAdd(a.transcript,{groceryLists,taskLists})) || alternatives[0];
        const heard=(final.length===1?best?.transcript:final.map(r=>r[0]?.transcript || '').join(' '))?.trim() || '';
        stop();setTranscript(heard);
        if(!heard){say('I didn’t catch that. Please try again.');return;}
        if(parseVoiceQuickAdd(heard,{groceryLists,taskLists})){review(heard);return;}
        const replyMode = nextMode();
        if(replyMode==='confirm'){
          const answer=parseVoiceConfirmation(heard);
          if(answer==='yes')save(actionRef.current);
          else if(answer==='no'){setAction(null);say('Okay, I won’t add it.');}
          else if(actionRef.current?.type==='event')continueConversation(heard);
          else say('Please say yes or no, or use the buttons below.');
        }else if(replyMode==='period' || replyMode==='followup')continueConversation(heard);
        else review(heard);
      };
      rec.onerror = (event) => {
        if (id !== current.current) return;
        if (event.error === 'no-speech') {
          recoverSilence();
          return;
        }
        if (resumed && ['aborted', 'audio-capture', 'network'].includes(event.error) && retryRecognition()) return;
        endConversation();
        setError(event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Allow microphone access in your browser, or type instead.'
          : 'The microphone disconnected. Tap Start talking to reconnect.');
      };
      rec.onend = () => {
        if (id !== current.current) return;
        recognition.current = null;
        recoverSilence();
      };
      setStartingMic(true);
      listenStartTimer.current = setTimeout(() => {
        if (id === current.current) microphoneUnavailable();
      }, 8000);
      rec.start();
    } catch {
      microphoneUnavailable();
    }
  };
  startRef.current = start;
  if (hidden) return null;
  const miaState = startingMic ? 'connecting' : listening ? 'listening' : speaking ? 'speaking' : thinking || preparingVoice ? 'thinking' : 'idle';
  const miaStateLabel = { idle: 'Your home assistant', connecting:'Connecting microphone…', listening: 'Listening…', speaking: 'Speaking…', thinking: 'Thinking…' }[miaState];
  const launcher=<button data-mia-state={miaState} className="voice-quick-fab" type="button" onClick={() => setOpen(true)} aria-label="Talk to Mia, voice assistant" aria-haspopup="dialog" aria-expanded={open}>
      <span className="voice-quick-fab-avatar" aria-hidden="true"><img src="/illustrations/mia-assistant.png" alt=""/></span>
      <span className="mia-launcher-copy"><span>Talk to Mia</span><small>{miaStateLabel}</small></span>
      <span className="mia-voice-wave" aria-hidden="true"><i/><i/><i/><i/></span>
    </button>;
  return <>{launcherTarget ? createPortal(launcher,launcherTarget) : launcher}
    <Modal open={open} onClose={close} title="Talk to Mia" className="voice-quick-modal"><AiPrivacyGate onCancel={close} onPause={endConversation} manageAfterContent><div className="voice-quick-content">
      <div className="voice-quick-conversation" data-mia-state={miaState} aria-live="polite">
        <span className="voice-quick-orb"><img src="/illustrations/mia-assistant.png" alt="" /></span>
        {conversationMode && <span className="mia-turn-status">{miaState === 'idle' ? 'Getting ready…' : miaStateLabel}</span>}
        <p className="voice-quick-prompt">{message}</p>
        {transcript && <p className="voice-quick-heard">You: “{transcript}”</p>}
      </div>
      <div className="mia-conversation-controls">
        <button type="button" className="voice-quick-listen" disabled={busy && !conversationMode} aria-pressed={conversationMode} onClick={() => {
          if (conversationMode) { endConversation(); return; }
          endConversation();
          if (user?.id) miaAudio.current = unlockMiaAudio(miaAudio.current);
          setTyping(false);
          setVoiceRecovery(false);
          continuous.current = true;
          setConversationMode(true);
          start();
        }}>{conversationMode ? <><MicOff size={18}/> End conversation</> : <><Mic size={18}/> Start talking</>}</button>
        <button type="button" className="voice-quick-type" disabled={busy} onClick={() => {
          endConversation();
          setTyping(!typing);
        }}>{typing ? 'Hide typing' : 'Type instead'}</button>
      </div>
      {voiceRecovery && <p className="voice-quick-privacy" role="status">Mia’s reply is on screen. You can keep talking.</p>}
      {action ? <div className="voice-quick-review"><TextField label={action.type === 'grocery' ? 'Shopping item' : action.type === 'task' ? 'Task' : action.type === 'event' ? 'Event' : action.type === 'meal' ? 'Meal' : 'List name'} value={action.name} onChange={e => setAction({ ...action, name: e.target.value })} maxLength={120}/>{action.type==='grocery' && <div className="mia-grocery-fields"><TextField label="Quantity" type="number" min="0.01" value={action.quantity || 1} onChange={e=>setAction({...action,quantity:Number(e.target.value)})}/><TextField label="Unit" value={action.unit || ''} onChange={e=>setAction({...action,unit:e.target.value})}/></div>}{action.type==='task' && <label>Due date<input aria-label="Due date" type="date" value={action.due || ''} onChange={e=>setAction({...action,due:e.target.value})}/></label>}{action.notes && <p>Notes: {action.notes}</p>}{action.location && <p>Location: {action.location}</p>}{action.listName && <p>Adding to: {action.listName}</p>}{action.type === 'event' && <>{action.ambiguousTime ? <div className="voice-quick-ambiguous"><label>Event date<input aria-label="Event date" type="date" value={action.ambiguousTime.date} onChange={e=>setAction({...action,ambiguousTime:{...action.ambiguousTime,date:e.target.value}})}/></label><fieldset><legend>Is {action.ambiguousTime.hour}:{String(action.ambiguousTime.minute).padStart(2,'0')} AM or PM?</legend><div className="voice-period-options"><button type="button" onClick={()=>setAction(resolveVoicePeriod(action,'am'))}>AM</button><button type="button" onClick={()=>setAction(resolveVoicePeriod(action,'pm'))}>PM</button></div></fieldset></div> : <><label>Start<input aria-label="Start" type="datetime-local" value={action.start} onChange={e=>setAction({...action,start:e.target.value})}/></label><label>End<input aria-label="End" type="datetime-local" value={action.end} onChange={e=>setAction({...action,end:e.target.value,assumedDuration:false})}/></label></>}<label>Repeat<select aria-label="Repeat" value={action.recurrence} onChange={e=>setAction({...action,recurrence:e.target.value})}><option value="none">Does not repeat</option><option value="daily">Every day</option><option value="weekly">Every week</option><option value="monthly">Every month</option><option value="yearly">Every year</option></select></label>{action.assumedDuration && <p>One hour suggested; please check the end time.</p>}<label>Calendar<select aria-label="Calendar" value={action.destination} onChange={e=>setAction({...action,destination:e.target.value})}><option value="family">{famosCalendar?.name || 'FamOS family calendar'}</option>{googleConnected && googleCalendars.filter(c=>selectedGoogleCalendarIds.includes(c.id) && ['owner','writer'].includes(c.accessRole)).map(c=><option key={c.id} value={c.id}>{googleCalendarAliases[c.id] || c.summary || 'Google Calendar'}</option>)}</select></label>{action.destination !== 'family' && action.recurrence !== 'none' && <p role="alert">Repeating events currently need the FamOS family calendar. Choose that calendar or turn off repeat.</p>}</>}{action.type === 'meal' && <><label>Meal date<input aria-label="Meal date" type="date" value={action.date} onChange={e=>setAction({...action,date:e.target.value})}/></label><label>Meal<select aria-label="Meal" value={action.slot} onChange={e=>setAction({...action,slot:e.target.value})}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option></select></label>{meals.some(m=>m.date===action.date && m.slot===action.slot && m.title) && <p>This will replace the meal already planned for this slot.</p>}</>}{features[featureFor(action.type)] !== false && <><PrimaryButton disabled={busy || !action.name.trim() || (action.type==='grocery' && action.quantity!=null && (!Number.isFinite(action.quantity)||action.quantity<=0)) || (action.type === 'event' && (!action.start || !action.end || new Date(action.end) <= new Date(action.start))) || (action.type === 'meal' && !action.date) || (action.type === 'event' && action.destination !== 'family' && action.recurrence !== 'none')} onClick={() => save()}>{busy ? 'Adding…' : 'Yes, add it'}</PrimaryButton></>}<SecondaryButton disabled={busy} onClick={() => { stop(); setAction(null); say('Okay, I won’t add it.'); }}>Cancel</SecondaryButton></div> : null}
      {error && <p role="alert" className="voice-quick-error">{error}</p>}
      {(typing || (!conversationMode && action && !action.ambiguousTime && ((action.type === 'event' && !action.start) || (action.type === 'meal' && !action.date)))) && <form className="voice-quick-review" onSubmit={event => {
        event.preventDefault();
        if (!followup.trim() || thinking) return;
        continueConversation(followup);
      }}>
        <TextField label={action ? 'Your reply' : 'Your request'} value={followup} onChange={e => setFollowup(e.target.value)} maxLength={500}/>
        <SecondaryButton type="submit" disabled={!followup.trim() || thinking}>{action ? 'Send reply' : 'Send'}</SecondaryButton>
      </form>}
      <details className="voice-quick-privacy">
        <summary>About voice</summary>
        <p>Mia uses an AI-generated voice. The microphone resumes after each reply and stops when you end the conversation, leave the app or pause for a while. FamOS doesn’t save audio.</p>
      </details>
    </div></AiPrivacyGate></Modal></>;
}
