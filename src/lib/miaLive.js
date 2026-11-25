import {supabaseUrl} from './supabase';

export function createMiaLive({onState,onUserText,onAssistantText,onProposal,onError}) {
  let socket, context, stream, processor, microphone, silentOutput;
  let closed = false, ready = false, nextAudio = 0, assistantText = '', startReject;
  let startTimer, audioItem = null, audioStart = 0;
  const sources = new Set(), transcripts = new Set(), calls = new Set();
  const send = event => {
    if (!closed && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
  };
  const clearAudio = () => {
    for (const source of sources) {try {source.stop();} catch {}}
    sources.clear();
    nextAudio = context?.currentTime || 0;
  };
  function stop() {
    if (closed) return;
    closed = true; ready = false; clearTimeout(startTimer);
    startReject?.(new Error('Conversation ended.')); startReject = null;
    for (const track of stream?.getTracks() || []) track.stop();
    processor?.disconnect(); microphone?.disconnect(); silentOutput?.disconnect();
    clearAudio(); context?.close().catch(()=>{});
    socket?.close();
    onState('idle');
  }
  function fail(message) {if (!closed) {stop(); onError(message);}}
  function playAudio(encoded,itemId) {
    if (!context || closed) return;
    const binary = atob(encoded);
    if (binary.length % 2) return;
    const samples = new Float32Array(binary.length / 2);
    for (let i=0;i<samples.length;i++) {
      const value = binary.charCodeAt(i*2) | binary.charCodeAt(i*2+1)<<8;
      samples[i] = (value >= 32768 ? value-65536 : value)/32768;
    }
    const buffer = context.createBuffer(1,samples.length,24000);
    buffer.copyToChannel(samples,0);
    const source = context.createBufferSource();source.buffer=buffer;source.connect(context.destination);
    const at = Math.max(context.currentTime+0.015,nextAudio);
    if (audioItem !== itemId) {audioItem=itemId;audioStart=at;}
    nextAudio=at+buffer.duration;sources.add(source);
    source.onended=()=>{sources.delete(source);if(!closed && sources.size===0)onState('listening');};
    source.start(at);onState('speaking');
  }
  async function start(token) {
    onState('connecting');
    startTimer=setTimeout(()=>fail('Live voice could not connect. Please try again.'),25000);
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio || !navigator.mediaDevices?.getUserMedia) throw new Error('Live voice is unavailable on this device. You can type instead.');
      context=new Audio({sampleRate:24000});await context.resume();
      if(closed)return;
      stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      if(closed){for(const track of stream.getTracks())track.stop();return;}
      await context.audioWorklet.addModule(new URL('/mia-audio-worklet.js',window.location.href).href);
      if(closed)return;
      microphone=context.createMediaStreamSource(stream);
      processor=new AudioWorkletNode(context,'mia-microphone');
      silentOutput=context.createGain();silentOutput.gain.value=0;
      microphone.connect(processor);processor.connect(silentOutput);silentOutput.connect(context.destination);
      socket=new WebSocket(`${supabaseUrl.replace(/^http/,'ws')}/functions/v1/mia-live`);
      processor.port.onmessage=event=>{
        if(!ready || closed)return;
        if(socket.bufferedAmount>131072){fail('Your connection is falling behind. Reconnect to continue.');return;}
        const bytes=new Uint8Array(event.data);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
        send({type:'input_audio_buffer.append',audio:btoa(binary)});
      };
      await new Promise((resolve,reject)=>{
        startReject=reject;
        socket.onopen=()=>send({type:'auth',token,localDate:new Date().toLocaleDateString('en-CA')});
        socket.onerror=()=>fail('Live voice could not connect. Please try again.');
        socket.onclose=()=>fail('The live conversation ended. Tap Start talking to reconnect.');
        socket.onmessage=async message=>{
          if(closed)return;
          let event;try{event=JSON.parse(message.data);}catch{return;}
          if(event.type==='mia.ready'){ready=true;clearTimeout(startTimer);startReject=null;onState('listening');resolve();return;}
          if(event.type==='mia.error'){fail(event.message || 'Live voice is unavailable.');return;}
          if(event.type==='mia.closed'){fail('The live conversation ended. Tap Start talking to reconnect.');return;}
          if(event.type==='input_audio_buffer.speech_started'){
            if(audioItem && context.currentTime>audioStart)send({type:'conversation.item.truncate',item_id:audioItem,content_index:0,audio_end_ms:Math.floor((context.currentTime-audioStart)*1000)});
            clearAudio();send({type:'response.cancel'});onState('listening');return;
          }
          if(event.type==='conversation.item.input_audio_transcription.completed' && !transcripts.has(event.item_id)){
            transcripts.add(event.item_id);onUserText(String(event.transcript || '').slice(0,2000));return;
          }
          if(event.type==='response.created'){assistantText='';onState('thinking');return;}
          if(['response.audio.delta','response.output_audio.delta'].includes(event.type)){playAudio(event.delta,event.item_id);return;}
          if(['response.audio_transcript.delta','response.output_audio_transcript.delta'].includes(event.type)){
            assistantText+=event.delta || '';onAssistantText(assistantText);return;
          }
          if(event.type==='response.function_call_arguments.done' && event.name==='prepare_addition' && !calls.has(event.call_id)){
            calls.add(event.call_id);
            let result;
            try{result=await onProposal(JSON.parse(event.arguments));}catch{result={error:'Could not prepare this addition. Ask the user to use the app.'};}
            send({type:'tool_result',call_id:event.call_id,result});
          }
        };
      });
    } catch(error) {
      if(!closed)fail(error.name==='NotAllowedError'?'Microphone permission is needed for live voice. You can type instead.':error.message || 'Live voice is unavailable.');
    }
  }
  return {start,stop,reply(text){clearAudio();send({type:'reply',text});},get connected(){return ready && !closed;}};
}
