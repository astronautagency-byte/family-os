import { useEffect } from 'react';
import { launchBrandConfetti, resetBrandConfetti } from '../lib/brandConfetti';
export default function Confetti() {
  useEffect(() => {
    const handler = event => launchBrandConfetti(event.detail);
    window.addEventListener('famos:confetti', handler);
    return () => { window.removeEventListener('famos:confetti', handler); resetBrandConfetti(); };
  }, []);
  return null;
}
