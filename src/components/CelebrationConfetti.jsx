const PALETTE = ["#7F56D9", "#D94F91", "#E07A2F", "#169B62", "#3478F6", "#FFB11B"];

export default function CelebrationConfetti({ intensity = 44 }) {
  const count = Math.max(18, Math.min(Number(intensity) || 44, 64));
  return (
    <div className="celebration-confetti" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => {
        const side = index % 2 === 0 ? -1 : 1;
        const lane = ((index * 37) % 100) / 100;
        const x = side * (18 + lane * 46);
        const y = -(32 + ((index * 29) % 58));
        const rotate = side * (180 + ((index * 71) % 540));
        return <i key={index} style={{
          "--confetti-x": `${x}vw`, "--confetti-y": `${y}vh`, "--confetti-rotate": `${rotate}deg`,
          "--confetti-delay": `${(index % 9) * 24}ms`, "--confetti-color": PALETTE[index % PALETTE.length],
          "--confetti-left": `${8 + ((index * 43) % 84)}%`, "--confetti-scale": 0.72 + (index % 4) * 0.13,
        }} />;
      })}
    </div>
  );
}
