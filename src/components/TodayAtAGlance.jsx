import { CalendarDays, CheckSquare, ChefHat, ShoppingCart, ChevronRight } from './icons';

export default function TodayAtAGlance({ features, hidden, eventCount, taskCount, dinner, shoppingCount, onSelect }) {
  const cards = [
    { id: 'schedule', feature: 'calendar', page: 'calendar', label: 'Calendar', emoji: '📅', value: `${eventCount} ${eventCount === 1 ? 'event' : 'events'} today`, icon: CalendarDays },
    { id: 'tasks', feature: 'tasks', page: 'tasks', label: 'Tasks', emoji: '✅', value: `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'} to do`, icon: CheckSquare },
    { id: 'meals', feature: 'meals', page: 'meals', label: 'Dinner', emoji: '🍽️', value: dinner || 'Plan a meal', icon: ChefHat },
    { id: 'groceries', feature: 'groceries', page: 'groceries', label: 'Shopping', emoji: '🛒', value: `${shoppingCount} ${shoppingCount === 1 ? 'item' : 'items'} to get`, icon: ShoppingCart },
  ].filter(card => features[card.feature] !== false && !hidden.includes(card.id));
  if (!cards.length) return null;
  return <section className="today-glance" aria-labelledby="today-glance-title">
    <div className="today-glance-heading"><h2 id="today-glance-title">Your day at a glance</h2><span>Tap to open</span></div>
    <div className="today-glance-grid">{cards.map(({ id, page, label, value, emoji, icon: Icon }) =>
      <button type="button" className={`today-glance-card today-glance-card--${id}`} key={id} onClick={() => onSelect(page)}>
        <span className="today-glance-icon"><Icon size={18} aria-hidden="true" /></span><span className="today-glance-emoji" aria-hidden="true">{emoji}</span>
        <span className="today-glance-copy"><span>{label}</span><strong>{value}</strong></span>
        <ChevronRight className="today-glance-arrow" size={16} aria-hidden="true" />
      </button>
    )}</div>
  </section>;
}
