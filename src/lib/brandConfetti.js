import confetti from 'canvas-confetti';
export const BRAND_CONFETTI_COLORS = ['#16865D', '#F6AE96', '#F4D15B', '#9DD7EB'];
let canvas;
let cannon;
export function resetBrandConfetti() {
  cannon?.reset(); canvas?.remove(); canvas = undefined; cannon = undefined;
}
export function launchBrandConfetti({particleCount = 100, duration = 2500} = {}) {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true'); canvas.dataset.famosConfetti = 'true';
    Object.assign(canvas.style, {position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'10000'});
    document.body.appendChild(canvas);
    cannon = confetti.create(canvas, {resize:true, useWorker:true, disableForReducedMotion:true});
  }
  const count = Math.max(0, Math.min(160, Number(particleCount) || 0));
  const options = {particleCount:Math.ceil(count / 2), colors:BRAND_CONFETTI_COLORS, spread:65, startVelocity:42, gravity:1, decay:0.92, ticks:Math.max(60,Math.min(220,Number(duration) / 16 || 160)), scalar:0.9, disableForReducedMotion:true};
  cannon({...options,angle:60,origin:{x:0,y:0.65}});
  const active = cannon;
  Promise.resolve(cannon({...options,angle:120,origin:{x:1,y:0.65}})).then(() => { if (cannon === active) resetBrandConfetti(); });
}
