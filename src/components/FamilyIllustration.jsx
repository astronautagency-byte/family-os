import './family-cards.css';

export const FAMILY_ART = {
  home: 'welcome', welcome: 'welcome', calendar: 'calendar', tasks: 'tasks',
  rewards: 'rewards', groceries: 'groceries', kitchen: 'kitchen', meals: 'meals',
  recipes: 'meals', chat: 'chat', settings: 'family', family: 'family', famai: 'famai', finance: 'finance',
};

export default function FamilyIllustration({ variant = 'welcome', className = '', eager = false }) {
  return <img className={`family-illustration ${className}`} src={`/illustrations/family-v4/${FAMILY_ART[variant] || 'welcome'}.png`} alt="" aria-hidden="true" loading={eager ? 'eager' : 'lazy'} decoding="async" width="1024" height={variant === 'welcome' || variant === 'home' ? '683' : '1024'} />;
}
