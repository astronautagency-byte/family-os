import { CalendarDays, Home, GraduationCap, BriefcaseBusiness, Users } from 'lucide-react';
import { formatTime } from '../lib/dates';
const icons = { school:GraduationCap, work:BriefcaseBusiness, family:Home, social:Users };
export default function ReferenceAgenda({ events, onSelect, colorFor }) {
  return <div className="reference-day-agenda" aria-label="Selected day events">
    {events.length ? events.map(event => {
      const Icon = icons[event.eventType] || CalendarDays;
      return <button type="button" key={event.id} onClick={() => onSelect(event)} className="reference-agenda-row" style={{'--event-tone':colorFor(event)}}>
        <time dateTime={event.start}>{event.allDay ? 'All day' : formatTime(event.start)}</time>
        <span className="reference-agenda-card"><span className="reference-agenda-icon"><Icon size={20}/></span><span><strong>{event.title || 'Untitled event'}</strong>{event.location && <small>{event.location}</small>}</span></span>
      </button>;
    }) : <p className="reference-agenda-empty">No events planned for this day.</p>}
  </div>;
}
