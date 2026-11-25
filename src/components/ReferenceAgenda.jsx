import { CalendarDays, Home, GraduationCap, BriefcaseBusiness, Users } from "./icons";
import { dateToISO, formatTime } from '../lib/dates';
import { isAllDayEvent, eventOccursOnDate } from '../lib/calendarEventDates';
import FamilyIllustration from './FamilyIllustration';
const icons = { school:GraduationCap, work:BriefcaseBusiness, family:Home, social:Users };
export default function ReferenceAgenda({ events, onSelect, colorFor, onAdd }) {
  return <div className="reference-day-agenda" aria-label="Selected day events">
    {events.length ? events.map(event => {
      const Icon = icons[event.eventType] || CalendarDays;
      return <button type="button" key={event.id} onClick={() => onSelect(event)} className="reference-agenda-row" style={{'--event-tone':colorFor(event)}}>
        <time dateTime={event.start}>{isAllDayEvent(event) ? 'All day' : formatTime(event.start)}</time>
        <span className="reference-agenda-card"><span className="reference-agenda-icon"><Icon size={20}/></span><span><strong>{event.title || 'Untitled event'}</strong>{event.location && <small>{event.location}</small>}</span></span>
      </button>;
    }) : <div className="reference-agenda-empty"><FamilyIllustration variant="calendar" className="empty-state-art" sizes="96px"/><p>No events planned for this day.</p>{onAdd && <button type="button" className="empty-state-action" onClick={onAdd}>Add event</button>}</div>}
  </div>;
}

export function WeekAgenda({dates, events, onSelect, colorFor, onAdd}) {
  return <div className="reference-week-agenda" aria-label="Week events">
    {dates.map(date => {
      const day = dateToISO(date);
      const dayEvents = events.filter(event => eventOccursOnDate(event, day)).sort((a,b) => a.start.localeCompare(b.start));
      return <section key={day} aria-label={date.toLocaleDateString('en-CA', {weekday:'long',month:'long',day:'numeric'})}>
        <h3><time dateTime={day}>{date.toLocaleDateString('en-CA', {weekday:'long',month:'short',day:'numeric'})}</time></h3>
        {dayEvents.length ? <ReferenceAgenda events={dayEvents} onSelect={onSelect} colorFor={colorFor}/> : <p className="reference-week-empty">No events</p>}
        <button type="button" className="reference-week-add" aria-label={`Add event on ${day}`} onClick={() => onAdd(day)}>Add event</button>
      </section>;
    })}
  </div>;
}
