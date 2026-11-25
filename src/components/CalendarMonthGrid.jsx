import {eventOccursOnDate} from '../lib/calendarEventDates';
import './calendar-month-grid.css';

const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

export default function CalendarMonthGrid({cells,month,selectedDate,today,events,onSelectDate,colorFor}) {
  return <div className="calendar-month-grid calendar-month-events" aria-label="Month events">
    {cells.map(date=>{
      const key=dateKey(date);
      const dayEvents=events.filter(event=>eventOccursOnDate(event,key)).sort((a,b)=>(a.start || '').localeCompare(b.start || ''));
      const label=date.toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
      return <button type="button" key={key} aria-pressed={key===selectedDate} aria-current={key===today?'date':undefined}
        aria-label={`${label}, ${dayEvents.length} event${dayEvents.length===1?'':'s'}${dayEvents.length?': '+dayEvents.map(event=>event.title).join(', '):''}`}
        className={`${date.getMonth()===month.getMonth()?'':'outside'} ${key===selectedDate?'selected':''} ${key===today?'today':''}`}
        onClick={()=>onSelectDate(key)}>
        <b>{date.getDate()}</b>
        <span className="calendar-month-event-list" aria-hidden="true">
          {dayEvents.slice(0,2).map(event=><span className="calendar-month-event-title" key={event.id} style={{'--event-tone':colorFor(event)}}>{event.title}</span>)}
          {dayEvents.length>2 && <span className="calendar-month-event-more">+{dayEvents.length-2} more</span>}
        </span>
      </button>;
    })}
  </div>;
}
