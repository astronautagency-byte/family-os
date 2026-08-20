import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";

const PARTY_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
  "#BB8FCE", "#85C1E9", "#F8B500", "#FF6F61",
  "#6B5B95", "#88B04B", "#F7CAC9", "#92A8D1",
];

function createParticle(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h - h,
    color: PARTY_COLORS[Math.floor(Math.random() * PARTY_COLORS.length)],
    size: Math.random() * 8 + 4,
    speedY: Math.random() * 3 + 2,
    speedX: (Math.random() - 0.5) * 2,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.2,
    phase: Math.random() * Math.PI * 2,
    oscillateSpeed: Math.random() * 0.05 + 0.02,
    shape: Math.random() > 0.5 ? "rect" : "circle",
  };
}

export default function Confetti() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);
  const startRef = useRef(null);
  const [active, setActive] = useState(false);
  const durationRef = useRef(3000);

  const fire = useCallback((particleCount = 80, duration = 3000) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    durationRef.current = duration;
    particlesRef.current = Array.from({ length: particleCount }, () =>
      createParticle(canvas.width, canvas.height)
    );
    startRef.current = Date.now();
    setActive(true);
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const elapsed = Date.now() - startRef.current;
    const progress = Math.min(elapsed / durationRef.current, 1);

    particlesRef.current.forEach((p) => {
      p.y += p.speedY;
      p.x += Math.sin(p.phase) * 0.5 + p.speedX;
      p.phase += p.oscillateSpeed;
      p.angle += p.spin;

      const alpha = progress < 0.8 ? 1 : 1 - (progress - 0.8) / 0.2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;

      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    if (progress < 1) {
      animRef.current = requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, width, height);
      setActive(false);
    }
  }, []);

  // Listen for custom confetti events
  useEffect(() => {
    const handler = (e) => {
      const { particleCount, duration } = e.detail || {};
      fire(particleCount, duration);
    };
    window.addEventListener("famos:confetti", handler);
    return () => window.removeEventListener("famos:confetti", handler);
  }, [fire]);

  useEffect(() => {
    if (active) {
      animRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [active, animate]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
