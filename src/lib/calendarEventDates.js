import {dateToISO, eventDateLocal} from './dates';
/** Old stored calendar events lack an all-day flag; match the existing calendar grid fallback. */
export function isAllDayEvent(event) {
 if(event?.allDay === true)return true;
 if(event?.allDay === false)return false;
 const start=new Date(event?.start),end=new Date(event?.end);
 return Number.isFinite(start.getTime())&&Number.isFinite(end.getTime())&&start.getHours()===0&&start.getMinutes()===0&&end-start>=23*60*60*1000;
}
export function eventOccursOnDate(event,day){
 if(!isAllDayEvent(event))return eventDateLocal(event.start)===day;
 const start=event.allDayStart || eventDateLocal(event.start);
 if(event.allDayEndExclusive)return day>=start&&day<event.allDayEndExclusive;
 const end=new Date(event.end);if(!Number.isFinite(end.getTime()))return day===start;
 const last=dateToISO(end);return day>=start&&(end.getHours()===0&&end.getMinutes()===0?day<last:day<=last);
}
