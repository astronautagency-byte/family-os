import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

export default function Confetti() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);
  const startRef = useRef(null);
  const [active, setActive] = useState(false);
  const durationRef = useRef(2500);

  const COLORS = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
    "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
    "#BB8FCE", "#85C1E9", "#F8B500", "#FF6F61",
    "#6B5B95", "#88B04B", "#F7CAC9", "#92A8D1",
  ];

  const fire = useCallback((particleCount = 120, duration = 2500, origin) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    durationRef.current = duration;
    startRef.current = Date.now();

    const cx = origin?.x ?? canvas.width / 2;
    const cy = origin?.y ?? canvas.height / 2;

    particlesRef.current = Array.from({ length: particleCount }, () => {
      const angle = randomInRange(0, Math.PI * 2);
      const speed = randomInRange(8, 22);
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - randomInRange(5, 15),
        color: COLORS[Math.floor(randomInRange(0, COLORS.length))],
        size: randomInRange(6, 12),
        rotation: randomInRange(0, Math.PI * 2),
        rotationSpeed: randomInRange(-0.2, 0.2),
        gravity: 0.5,
        drag: 0.99,
        alpha: 1,
        shape: Math.random() > 0.5 ? "square" : "circle",
        wobble: randomInRange(-0.1, 0.1),
        wobbleSpeed: randomInRange(0.05, 0.15),
        wobblePhase: randomInRange(0, Math.PI * 2),
      };
    });
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

    particlesRef.current.forEach((p, i) => {
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.wobblePhase += p.wobbleSpeed;

      if (progress > 0.6) {
        p.alpha = Math.max(0, 1 - (progress - 0.6) / 0.4);
      }

      if (p.alpha <= 0) {
        particlesRef.current.splice(i, 1);
        return;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation + Math.sin(p.wobblePhase) * p.wobble);
      ctx.fillStyle = p.color;

      const size = p.size * (0.5 + 0.5 * p.alpha);

      if (p.shape === "circle") {
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-size / 2, -size / 2, size, size);
      }
      ctx.restore();
    });

    if (particlesRef.current.length > 0 && progress < 1) {
      animRef.current = requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, width, height);
      setActive(false);
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const { particleCount, duration, origin } = e.detail || {};
      fire(particleCount, duration, origin);
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