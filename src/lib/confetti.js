// Lightweight confetti trigger — dispatch a custom event from anywhere
// and the Confetti layer in App.jsx will pick it up.
export function fireConfetti(particleCount = 80, duration = 3000) {
  window.dispatchEvent(
    new CustomEvent("famos:confetti", { detail: { particleCount, duration } })
  );
}
