import { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from './icons';
import FamilyIllustration from './FamilyIllustration';

/** Native scrolling keeps vertical page gestures intact; buttons are an equivalent to swipe. */
export default function FamilyCardRail({ title, cards, onSelect }) {
  const rail = useRef(null);
  const id = useId();
  const [edges, setEdges] = useState({ start: true, end: true });
  const signature = cards.map(card => card.id).join('|');
  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    const update = () => setEdges({ start: node.scrollLeft <= 2, end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 2 });
    update();
    node.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(node);
    return () => { node.removeEventListener('scroll', update); window.removeEventListener('resize', update); observer?.disconnect(); };
  }, [signature]);
  if (!cards.length) return null;
  const move = direction => {
    const node = rail.current;
    if (!node) return;
    const card = node.firstElementChild;
    const distance = card ? card.getBoundingClientRect().width + 12 : node.clientWidth;
    node.scrollBy({ left: direction * distance, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  return <section className="family-card-section" aria-label={title}>
    <div className="family-card-heading"><h2>{title}</h2><div className="family-card-controls">
      <button type="button" aria-label={`Previous ${title.toLowerCase()} cards`} aria-controls={id} disabled={edges.start} onClick={() => move(-1)}><ChevronLeft size={18}/></button>
      <button type="button" aria-label={`Next ${title.toLowerCase()} cards`} aria-controls={id} disabled={edges.end} onClick={() => move(1)}><ChevronRight size={18}/></button>
    </div></div>
    <div className="family-card-rail" id={id} ref={rail} role="list">
      {cards.map(card => <article className="family-story-card" key={card.id} role="listitem">
        <FamilyIllustration variant={card.art || card.id}/>
        <div className="family-story-copy"><p>{card.label}</p><h3>{card.title}</h3><span>{card.detail}</span>
          {onSelect && <button type="button" onClick={() => onSelect(card.id)}>{card.action}<ChevronRight size={16}/></button>}
        </div>
      </article>)}
    </div>
  </section>;
}
