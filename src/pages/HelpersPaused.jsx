import {useEffect} from 'react';

export default function HelpersPaused(){
  useEffect(()=>{
    try{sessionStorage.removeItem('famos:guest-helper');}catch{/* Storage may be unavailable in private browsing. */}
    // Remove private invitation material without redirecting it elsewhere.
    if(window.location.hash)window.history.replaceState(null,'','/helpers');
  },[]);
  return <main style={{maxWidth:440,margin:'12vh auto',padding:24,fontFamily:'system-ui',lineHeight:1.6}}>
    <a href="/">FamOS</a><h1>Helper access is paused</h1>
    <p>Shared helper links and passcodes are unavailable while we simplify FamOS.</p>
    <p>Your family’s calendars and lists are still available in the family app.</p>
    <a href="https://home.fam-os.app/">Open FamOS</a>
  </main>;
}
