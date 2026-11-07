import { useEffect, useState } from 'react';
import './fam-loading.css';

// The short, silent loop is cropped from the FamOS social ad supplied by the
// product owner. Loading still ends as soon as the underlying work finishes.
export default function FamLoading({ compact = false, label = 'Loading FamOS' }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const sync = () => setAnimate(Boolean(preference) && !preference.matches && document.visibilityState !== 'hidden');
    sync();
    preference?.addEventListener?.('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => { preference?.removeEventListener?.('change', sync); document.removeEventListener('visibilitychange', sync); };
  }, []);
  return <div className={`fam-loading${compact ? ' fam-loading--compact' : ''}`} role="status" aria-live="polite">
    <div className="fam-loading-art" aria-hidden="true">
      {animate ? <video autoPlay loop muted playsInline preload="auto" poster="/animations/family-high-five-poster.png"><source src="/animations/family-high-five.mp4" type="video/mp4"/></video> : <img src="/animations/family-high-five-poster.png" alt=""/>}
    </div>
    <span>{label}<span aria-hidden="true">…</span></span>
  </div>;
}
