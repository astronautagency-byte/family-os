import './family-cards.css';

export const FAMILY_ART = {
  home: 'welcome', welcome: 'welcome', calendar: 'calendar', tasks: 'tasks',
  rewards: 'rewards', groceries: 'groceries', kitchen: 'kitchen', meals: 'meals',
  recipes: 'meals', chat: 'chat', settings: 'family', family: 'family', famai: 'famai', finance: 'finance',
};

export function familyArtProps(variant = 'welcome') {
  const art = FAMILY_ART[variant] || 'welcome';
  const base = `/illustrations/family-v4/${art}`;
  return { src: `${base}-480.webp`, srcSet: `${base}-192.webp 192w, ${base}-480.webp 480w, ${base}-960.webp 960w`, width: 1024, height: art === 'welcome' ? 683 : 1024 };
}

export default function FamilyIllustration({ variant = 'welcome', className = '', eager = false }) {
  return <img className={`family-illustration ${className}`} {...familyArtProps(variant)} sizes="(max-width: 600px) 280px, 480px" alt="" aria-hidden="true" loading={eager ? 'eager' : 'lazy'} decoding="async" width="1024" height={variant === 'welcome' || variant === 'home' ? '683' : '1024'} />;
}
