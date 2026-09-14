import { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { lockBodyScroll } from '../lib/bodyScrollLock';

export default function CompletionScreen({ kind = 'task', onClose }) {
  const button = useRef(null);
  const titleId = useId();
  const shopping = kind === 'shopping';
  useEffect(() => {
    const previous = document.activeElement;
    const unlock = lockBodyScroll();
    button.current?.focus();
    return () => { unlock(); if (previous?.isConnected) previous.focus?.(); };
  }, []);
  return createPortal(<div className="completion-screen m3-dialog-layer" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={event => {
    if (event.key === 'Escape') onClose();
    if (event.key === 'Tab') {
      const controls = event.currentTarget.querySelectorAll('button');
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }}>
    <div className="completion-confetti" aria-hidden="true">{Array.from({length:36}, (_,i) => <i key={i} style={{left:`${(i*37+5)%100}%`,top:`${(i*23+3)%100}%`,background:['#19B989','#FFBE3C','#A272F7','#FF646F','#5ECDF0'][i%5],transform:`rotate(${i*29}deg)`,animationDelay:`-${i%7}s`}}/>)}</div>
    <button className="completion-close" onClick={onClose} aria-label="Close celebration"><X size={22}/></button>
    <div className="completion-content">
      <div className={`completion-art ${shopping ? 'shopping' : 'task'}`}><img src={`/illustrations/celebrations/${shopping?'cart':'trophy'}.png`} alt=""/></div>
      <h1 id={titleId}>{shopping ? 'Shopping Complete!' : 'Task Completed!'}</h1>
      <p>{shopping ? <>All items checked off!<br/>You’re a family hero. <span aria-hidden="true">❤️</span></> : <>Great job!<br/>You’re keeping the family<br/>on track <span aria-hidden="true">🙌</span></>}</p>
      <button ref={button} className="completion-confirm" onClick={onClose}>{shopping ? 'Nice!' : 'Awesome!'}</button>
    </div>
  </div>, document.body);
}
