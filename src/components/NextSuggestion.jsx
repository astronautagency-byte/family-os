import { CalendarDays, CheckSquare, ChefHat, ShoppingCart, ChevronRight, X } from './icons';
const icons = {calendar: CalendarDays, tasks: CheckSquare, meals: ChefHat, groceries: ShoppingCart};
export default function NextSuggestion({ suggestion, onOpen, onDismiss }) {
  if (!suggestion) return null;
  const Icon=icons[suggestion.page] || CalendarDays;
  return <div className="today-next-container">
    <button type="button" className={`today-next today-next--${suggestion.page}${onDismiss ? " today-next--dismissible" : ""}`} onClick={() => onOpen(suggestion.page)}>
      <span className="today-next-icon" aria-hidden="true"><Icon size={21}/></span>
      <span className="today-next-copy"><small>Up next{suggestion.when && <> · {suggestion.when}</>}</small><strong>{suggestion.title}</strong>{suggestion.detail && <span>{suggestion.detail}</span>}</span>
      <span className="today-next-action">{suggestion.action}<ChevronRight size={16} aria-hidden="true"/></span>
    </button>
    {onDismiss && <button type="button" className="today-next-dismiss" onClick={onDismiss} aria-label="Dismiss suggestion for today"><X size={20} aria-hidden="true"/></button>}
  </div>;
}
