import { useEffect, useRef, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Plus, Trash2 } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { AvatarStack, DateField, Modal, PrimaryButton, SecondaryButton, TextField } from "../components/ui";
import PageHeader from "../components/PageHeader";
import { formatTime, todayISO } from "../lib/dates";
import { fetchGooglePlaceSuggestions, googleMapsApiKey, loadGooglePlaces } from "../lib/googleMapsPlaces";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const EVENT_TYPES = {
  family: { label: "Family", color: "#5b55d6" },
  school: { label: "School", color: "#4f8177" },
  activity: { label: "Activities", color: "#dc9147" },
  health: { label: "Health", color: "#d46b7a" },
  work: { label: "Work", color: "#747184" },
};
const eventType = (event) => {
  if (event.eventType && EVENT_TYPES[event.eventType]) return event.eventType;
  const text = `${event.title} ${event.location || ""}`.toLowerCase();
  if (/school|class|teacher|homework|project/.test(text)) return "school";
  if (/doctor|dentist|clinic|health|appointment/.test(text)) return "health";
  if (/practice|soccer|hockey|dance|game|gym|swim/.test(text)) return "activity";
  if (/work|meeting|client|office/.test(text)) return "work";
  return "family";
};
const sourceId = (event) => event.source === "google" ? `google:${event.calendarId||"primary"}` : event.sourceFeedId ? `feed:${event.sourceFeedId}` : "family";

function LocationAutocompleteField({ value, onChange }) {
  const inputRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const googleRef = useRef(null);
  const placesRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const requestIdRef = useRef(0);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!googleMapsApiKey) {
      setMapsError("Google Maps suggestions are not configured yet.");
      return undefined;
    }
    let cancelled = false;

    loadGooglePlaces()
      .then(({ google, places }) => {
        if (cancelled) return;
        googleRef.current = google;
        placesRef.current = places;
        sessionTokenRef.current = new places.AutocompleteSessionToken();
        setMapsError("");
        setMapsReady(true);
      })
      .catch(() => setMapsError("Location suggestions are unavailable right now."));

    return () => {
      cancelled = true;
      requestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const input = value.trim();
    if (!mapsReady || input.length < 2 || !placesRef.current) {
      setSuggestions([]);
      setActiveSuggestion(-1);
      return undefined;
    }

    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const nextSuggestions = await fetchGooglePlaceSuggestions({
          google: googleRef.current,
          places: placesRef.current,
          input,
          sessionToken: sessionTokenRef.current,
        });
        if (requestId !== requestIdRef.current) return;
        setSuggestions(nextSuggestions.filter((suggestion) => suggestion.placePrediction).slice(0, 6));
        setActiveSuggestion(-1);
        setMapsError("");
      } catch {
        if (requestId !== requestIdRef.current) return;
        setSuggestions([]);
        setMapsError("Location suggestions are unavailable right now.");
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [mapsReady, value]);

  const chooseSuggestion = async (suggestion) => {
    const prediction = suggestion?.placePrediction;
    if (!prediction) return;
    const fallbackLabel = prediction.text?.toString?.() || "";
    setSuggestions([]);
    setActiveSuggestion(-1);

    try {
      if (typeof prediction.toPlace === "function") {
        const place = prediction.toPlace();
        await place.fetchFields({ fields: ["displayName", "formattedAddress"] });
        onChangeRef.current(place.formattedAddress || place.displayName || fallbackLabel);
      } else {
        onChangeRef.current(prediction.legacyPrediction?.description || fallbackLabel);
      }
    } catch {
      if (fallbackLabel) onChangeRef.current(fallbackLabel);
    }

    const places = placesRef.current;
    if (places?.AutocompleteSessionToken) {
      sessionTokenRef.current = new places.AutocompleteSessionToken();
    }
    inputRef.current?.blur();
  };

  const handleKeyDown = (event) => {
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((current) => Math.min(current + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && activeSuggestion >= 0) {
      event.preventDefault();
      chooseSuggestion(suggestions[activeSuggestion]);
    } else if (event.key === "Escape") {
      setSuggestions([]);
      setActiveSuggestion(-1);
    }
  };

  return (
    <div className="location-autocomplete-field">
      <span>Location (optional)</span>
      <div className="location-autocomplete-wrap">
        <div className="location-autocomplete-input">
          <MapPin size={17} />
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search a place or enter an address"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
          />
        </div>
        {suggestions.length > 0 && (
          <div className="location-suggestions" role="listbox">
            {suggestions.map((suggestion, index) => {
              const prediction = suggestion.placePrediction;
              const mainText = prediction.mainText?.toString?.() || prediction.text?.toString?.() || "";
              const secondaryText = prediction.secondaryText?.toString?.() || "";
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeSuggestion}
                  className={index === activeSuggestion ? "active" : ""}
                  key={prediction.placeId || `${mainText}-${index}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseSuggestion(suggestion)}
                >
                  <MapPin size={16} />
                  <span><strong>{mainText}</strong>{secondaryText && <small>{secondaryText}</small>}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {googleMapsApiKey && mapsReady && !mapsError && <small>Start typing to pick a Google Maps place.</small>}
      {mapsError && <small className="warn">{mapsError}</small>}
    </div>
  );
}

export default function CalendarPage() {
  const { members, memberById, events, googleEvents, feedEvents, calendarFeeds, googleConnected, googleCalendars, selectedGoogleCalendarIds, addEvent, addGoogleCalendarEvent, removeEvent, clearEvents } = useFamily();
  const [selectedDate,setSelectedDate]=useState(todayISO());
  const selected=new Date(`${selectedDate}T12:00:00`);
  const [month,setMonth]=useState(new Date(selected.getFullYear(),selected.getMonth(),1));
  const [sourceFilter,setSourceFilter]=useState("all");
  const [adding,setAdding]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState("");
  const [clearing,setClearing]=useState(false);
  const [selectedEvent,setSelectedEvent]=useState(null);
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [touchStart,setTouchStart]=useState(null);
  const [draft,setDraft]=useState({title:"",date:selectedDate,start:"18:00",end:"19:00",location:"",memberIds:[],eventType:"family",destination:"family"});
  const allEvents=useMemo(()=>[...events,...googleEvents,...feedEvents],[events,googleEvents,feedEvents]);
  const visibleEvents=useMemo(()=>sourceFilter === "all" ? allEvents : allEvents.filter((event)=>sourceId(event)===sourceFilter),[allEvents,sourceFilter]);
  const sources=useMemo(()=>[
    {id:"all",label:"All calendars"},{id:"family",label:"Family"},
    ...(googleConnected?googleCalendars.filter(calendar=>selectedGoogleCalendarIds.includes(calendar.id)).map(calendar=>({id:`google:${calendar.id}`,label:calendar.summary,color:calendar.backgroundColor})):[]),
    ...calendarFeeds.map((feed)=>({id:`feed:${feed.id}`,label:feed.name})),
  ],[calendarFeeds,googleConnected,googleCalendars,selectedGoogleCalendarIds]);
  const cells=useMemo(()=>{const first=new Date(month.getFullYear(),month.getMonth(),1);const start=new Date(first);start.setDate(1-first.getDay());return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});},[month]);
  const dayEvents=visibleEvents.filter(e=>e.start.slice(0,10)===selectedDate).sort((a,b)=>a.start.localeCompare(b.start));
  const monthLabel=month.toLocaleDateString("en-CA",{month:"long",year:"numeric"});
  const selectedLabel=selected.toLocaleDateString("en-CA",{month:"short",day:"numeric",weekday:"short"}).toUpperCase();
  const canDeleteEvent=(event)=>sourceId(event)==="family";
  const mapsUrl=(location)=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  const openAdd=()=>{setDraft({title:"",date:selectedDate,start:"18:00",end:"19:00",location:"",memberIds:members.map(m=>m.id),eventType:"family",destination:"family"});setSaveError("");setAdding(true);};
  const save=async()=>{if(!draft.title.trim())return;setSaving(true);setSaveError("");const payload={title:draft.title.trim(),start:new Date(`${draft.date}T${draft.start}:00`).toISOString(),end:new Date(`${draft.date}T${draft.end}:00`).toISOString(),location:draft.location,memberIds:draft.memberIds,eventType:draft.eventType};try{if(draft.destination.startsWith("google:"))await addGoogleCalendarEvent({...payload,calendarId:draft.destination.slice(7)});else await addEvent(payload);setAdding(false);}catch(error){setSaveError(error.message||"Could not save this event.");}finally{setSaving(false);}};
  const confirmDelete=async()=>{if(!deleteTarget)return;await removeEvent(deleteTarget.id);setDeleteTarget(null);if(selectedEvent?.id===deleteTarget.id)setSelectedEvent(null);};

  return <div className="pb-28 reference-calendar">
    <PageHeader title="Everyone’s where, when." illustration="calendar" subtitle={`${dayEvents.length} thing${dayEvents.length===1?"":"s"} on deck for this day.`} action={events.length?<button className="page-reset-button" onClick={()=>setClearing(true)}><Trash2/> Reset</button>:null} />
    <div className="px-5">
      <div className="calendar-source-filters" aria-label="Calendars">{sources.map(source=><button key={source.id} className={sourceFilter===source.id?"selected":""} onClick={()=>setSourceFilter(source.id)}>{source.color&&<i style={{backgroundColor:source.color}}/>}{source.label}</button>)}</div>
      <div className="month-toolbar"><div><h2>{monthLabel}</h2><p>{visibleEvents.filter(e=>e.start.slice(0,7)===iso(month).slice(0,7)).length} events this month</p></div><div><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft/></button><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight/></button></div></div>
      <div className="month-calendar">
        <div className="weekday-row">{["SUN","MON","TUE","WED","THU","FRI","SAT"].map(d=><span key={d}>{d}</span>)}</div>
        <div className="month-grid">{cells.map(d=>{const key=iso(d),inMonth=d.getMonth()===month.getMonth(),active=key===selectedDate,cellEvents=visibleEvents.filter(e=>e.start.slice(0,10)===key);return <button key={key} className={`${inMonth?"":"outside"} ${active?"selected":""}`} onClick={()=>setSelectedDate(key)}><b>{d.getDate()}</b>{cellEvents.length>0&&<span>{cellEvents.slice(0,3).map(event=><i key={event.id} style={{backgroundColor:EVENT_TYPES[eventType(event)].color}}/>)}</span>}</button>})}</div>
      </div>
      <div className="calendar-legend">{Object.entries(EVENT_TYPES).map(([key,type])=><span key={key}><i style={{backgroundColor:type.color}}/>{type.label}</span>)}</div>
      <div className="agenda-heading"><h3>DAY AT A GLANCE</h3><span>{selectedLabel}</span></div>
      <div className="day-agenda">{dayEvents.length===0?<p className="empty-agenda">Nothing on the books. Rare. Enjoy it.</p>:dayEvents.map(ev=>{const people=(ev.memberIds||[]).map(id=>memberById[id]).filter(Boolean);const type=EVENT_TYPES[eventType(ev)];const deletable=canDeleteEvent(ev);return <button className="agenda-row agenda-row-clickable" style={{"--event-color":type.color}} key={ev.id} onClick={()=>setSelectedEvent(ev)} onTouchStart={(event)=>setTouchStart(event.changedTouches[0]?.clientX ?? null)} onTouchEnd={(event)=>{const end=event.changedTouches[0]?.clientX;if(deletable&&touchStart!==null&&end!==undefined&&touchStart-end>64)setDeleteTarget(ev);setTouchStart(null);}}><time>{formatTime(ev.start)}</time><div><span className="event-type-label"><i style={{backgroundColor:type.color}}/>{type.label}</span><strong>{ev.title}</strong><p>{ev.location&&<><MapPin size={12}/>{ev.location}</>}{ev.location&&people.length>0&&" · "}{people.map(p=>p.name).join(", ")}</p></div><AvatarStack members={people}/>{deletable&&<span className="agenda-delete" onClick={(event)=>{event.stopPropagation();setDeleteTarget(ev);}} aria-label="Delete event" role="button" tabIndex={0}><Trash2 size={17}/></span>}</button>})}</div>
      <button className="reference-fab" onClick={openAdd} aria-label="Add event"><Plus/></button>
    </div>
    <Modal open={adding} onClose={()=>setAdding(false)} title="Add something to the calendar">
      <TextField label="Event" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/>
      <div className="calendar-form-row"><DateField label="Date" value={draft.date} onChange={date=>setDraft({...draft,date})}/><TextField label="Starts" type="time" value={draft.start} onChange={e=>setDraft({...draft,start:e.target.value})}/><TextField label="Ends" type="time" value={draft.end} onChange={e=>setDraft({...draft,end:e.target.value})}/></div>
      <LocationAutocompleteField value={draft.location} onChange={(location)=>setDraft((current)=>({...current,location}))}/>
      <label className="calendar-select-label"><span>Event type</span><select value={draft.eventType} onChange={e=>setDraft({...draft,eventType:e.target.value})}>{Object.entries(EVENT_TYPES).map(([key,type])=><option key={key} value={key}>{type.label}</option>)}</select></label>
      <label className="calendar-select-label"><span>Add to</span><select value={draft.destination} onChange={e=>setDraft({...draft,destination:e.target.value})}><option value="family">FamOS calendar</option>{googleConnected&&googleCalendars.filter(calendar=>selectedGoogleCalendarIds.includes(calendar.id)&&["owner","writer"].includes(calendar.accessRole)).map(calendar=><option key={calendar.id} value={`google:${calendar.id}`}>{calendar.summary} · Google</option>)}</select></label>
      {calendarFeeds.length>0&&<p className="calendar-readonly-note">Imported calendars are available in the filters above, but remain read-only.</p>}
      {saveError&&<p className="calendar-save-error">{saveError}</p>}
      <PrimaryButton onClick={save} disabled={saving}>{saving?"Adding…":"Add it"}</PrimaryButton>
    </Modal>
    <Modal open={!!selectedEvent} onClose={()=>setSelectedEvent(null)} title={selectedEvent?.title || "Event details"}>
      {selectedEvent && <div className="event-detail-card">
        <p className="event-detail-time">{formatTime(selectedEvent.start)}{selectedEvent.end ? ` – ${formatTime(selectedEvent.end)}` : ""}</p>
        <p className="event-detail-type"><i style={{backgroundColor:EVENT_TYPES[eventType(selectedEvent)].color}} />{EVENT_TYPES[eventType(selectedEvent)].label}</p>
        {selectedEvent.location ? <a className="event-map-link" href={mapsUrl(selectedEvent.location)} target="_blank" rel="noreferrer"><MapPin size={16}/> Open navigation to {selectedEvent.location}</a> : <p className="event-muted">No location added.</p>}
        <p className="event-muted">Source: {sourceId(selectedEvent)==="family" ? "FamOS calendar" : selectedEvent.source === "google" ? "Google Calendar" : "Imported calendar"}</p>
        <div className="reset-confirm-actions">
          <SecondaryButton onClick={()=>setSelectedEvent(null)}>Close</SecondaryButton>
          {canDeleteEvent(selectedEvent)&&<button className="event-danger-button" onClick={()=>setDeleteTarget(selectedEvent)}><Trash2 size={16}/> Delete event</button>}
        </div>
      </div>}
    </Modal>
    <Modal open={!!deleteTarget} onClose={()=>setDeleteTarget(null)} title="Delete event?"><p className="reset-confirm-copy">This removes “{deleteTarget?.title}” from the FamOS calendar.</p><div className="reset-confirm-actions"><button onClick={()=>setDeleteTarget(null)}>Cancel</button><PrimaryButton onClick={confirmDelete}>Delete event</PrimaryButton></div></Modal>
    <Modal open={clearing} onClose={()=>setClearing(false)} title="Reset FamOS calendar?"><p className="reset-confirm-copy">This removes FamOS events only. Connected Google and imported calendars are not changed.</p><div className="reset-confirm-actions"><button onClick={()=>setClearing(false)}>Cancel</button><PrimaryButton onClick={async()=>{await clearEvents();setClearing(false)}}>Clear FamOS events</PrimaryButton></div></Modal>
  </div>;
}
