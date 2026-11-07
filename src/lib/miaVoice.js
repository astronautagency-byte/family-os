/** Prefer enhanced neural/device voices; never choose a novelty voice. */
export function chooseMiaVoice(voices,language='en-CA') {
  const english=voices.filter(v=>/^en(?:-|$)/i.test(v.lang) && !/novelty|whisper|trinoids|zarvox|bells|boing|bad news|good news/i.test(v.name));
  return english.map(v=>({v,score:(/premium|enhanced|natural|neural/i.test(v.name)?100:0)+(/ava|samantha|siri|aria|jenny|sonia|serena|google.*english/i.test(v.name)?30:0)+(v.lang?.toLowerCase()===language.toLowerCase()?12:0)+(v.default?2:0)})).sort((a,b)=>b.score-a.score)[0]?.v || null;
}
export function unlockMiaAudio(existing) {
  try {
    const audio=existing || new Audio();
    // Unlock this same element inside the user's tap, before async synthesis.
    audio.src='data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
    const pending=audio.play();pending?.then(()=>{audio.pause();}).catch(()=>{});
    return audio;
  }catch{return null;}
}
