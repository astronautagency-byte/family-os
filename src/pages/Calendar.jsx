import { useEffect, useRef, useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, MapPin, Plus, Search, Settings2, Sparkles, Ticket, Trash2, TriangleAlert, X } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { useAuth } from "../context/AuthContext";
import { AvatarStack, DateField, Modal, PrimaryButton, SecondaryButton, TextField } from "../components/ui";
import PageHeader from "../components/PageHeader";
import PullToRefresh from "../components/PullToRefresh";
import { formatTime, todayISO } from "../lib/dates";
import { fetchGooglePlaceSuggestions, googleMapsApiKey, loadGooglePlaces } from "../lib/googleMapsPlaces";
import { invokeEdgeFunction } from "../lib/supabase";

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
  const { members, memberById, events, googleEvents, feedEvents, calendarFeeds, googleConnected, googleCalendars, selectedGoogleCalendarIds, sharedGoogleCalendarIds, addEvent, addGoogleCalendarEvent, removeEvent, clearEvents, refreshData, syncGoogleCalendarNow } = useFamily();
  const { householdProfileExtra } = useAuth();
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
  const [discovering,setDiscovering]=useState(false);
  const [discoverBusy,setDiscoverBusy]=useState(false);
  const [discoverError,setDiscoverError]=useState("");
  const [discoveredEvents,setDiscoveredEvents]=useState([]);
  const [discoverCategory,setDiscoverCategory]=useState("family events");
  const [discoverWhen,setDiscoverWhen]=useState("this weekend");
  const [discoverCities,setDiscoverCities]=useState([]);
  const [cityDraft,setCityDraft]=useState("");
  const [draft,setDraft]=useState({title:"",date:selectedDate,start:"18:00",end:"19:00",location:"",memberIds:[],eventType:"family",destination:"family"});
  const allEvents=useMemo(()=>[
    ...events,
    ...googleEvents.filter((event) => !sharedGoogleCalendarIds.includes(event.calendarId)),
    ...feedEvents,
  ],[events,googleEvents,feedEvents,sharedGoogleCalendarIds]);
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
  const discoverLocation=householdProfileExtra?.city || householdProfileExtra?.address || "";
  const searchCities=discoverCities.length?discoverCities:(discoverLocation?[discoverLocation]:[]);
  const addCity=(name)=>{
    const city=(name??cityDraft).trim();
    if(!city)return;
    setDiscoverCities((current)=>{
      const base=current.length?current:(discoverLocation?[discoverLocation]:[]);
      return base.some((c)=>c.toLowerCase()===city.toLowerCase())?base:[...base,city];
    });
    setCityDraft("");
  };
  const removeCity=(city)=>setDiscoverCities((current)=>{
    const base=current.length?current:(discoverLocation?[discoverLocation]:[]);
    return base.filter((c)=>c!==city);
  });
  const [resultDiagnostics,setResultDiagnostics]=useState(null);
  // Reset stale diagnostics whenever the city set mutates so the partial
  // banner does not linger after the user removes/Adds an area without
  // re-running the search.
  useEffect(()=>{
    setResultDiagnostics(null);
  },[searchCities.join("|")]);
  const formatCityFailure = (failures) => {
    if(!Array.isArray(failures)||!failures.length) return "";
    if(failures.length===1) return `${failures[0].city} couldn't be reached`;
    if(failures.length===2) return `${failures[0].city} and ${failures[1].city} couldn't be reached`;
    return `${failures.slice(0,-1).map((entry)=>`${entry.city}`).join(", ")} and ${failures.at(-1).city} couldn't be reached`;
  };
  const runSearch = async (citiesForRequest) => {
    if(!citiesForRequest.length){setDiscoverError("Add your home address in Settings, or add a city below, to discover nearby events.");setResultDiagnostics(null);return;}
    setDiscoverBusy(true);setDiscoverError("");
    // `gl` on the SerpApi call must match the household country — otherwise
    // every non-CA family sees zero results because the query is implicitly
    // "in <city>, Canada" downstream.
    const country=String(householdProfileExtra?.country||"ca").toLowerCase().slice(0,2);
    try{
      const result=await invokeEdgeFunction("search-local-events",{location:citiesForRequest[0],cities:citiesForRequest,category:discoverCategory,when:discoverWhen,country});
      setDiscoveredEvents(Array.isArray(result?.events)?result.events:[]);
      setResultDiagnostics(result?.diagnostics || null);
      if(!Array.isArray(result?.events)||!result.events.length){
        // Surface the real upstream error first — the static fallback only
        // shows when the provider actually returned zero matching items.
        if(result?.error){
          const cityNote=Array.isArray(result?.diagnostics?.perCityCounts)&&result.diagnostics.perCityCounts.length
            ?` (${result.diagnostics.perCityCounts.map((entry)=>`${entry.city}: ${entry.count}`).join(", ")})`
            :"";
          setDiscoverError(`${result.error}${cityNote}`.trim());
        }
        else if(result?.providerStatus==="partial_upstream_error"){
          const failed=Array.isArray(result?.diagnostics?.failedCities)&&result.diagnostics.failedCities.length?formatCityFailure(result.diagnostics.failedCities):"some areas";
          setDiscoverError(`${failed}. We still couldn't find a match — try a broader category or a different date.`);
        }
        else if(result?.providerStatus==="empty_results"){
          setDiscoverError(`No matching ${discoverCategory} for ${citiesForRequest.join(", ")} (${discoverWhen}). Try a broader category, another area, or a different date.`);
        }
        else{
          setDiscoverError("No matching events were found. Try a broader category, another city, or a different date.");
        }
      }
      else if(result?.providerStatus==="partial_upstream_error"){
        // Soft secondary line below the list — banner above + Retry CTA.
      }
    }catch(error){setDiscoveredEvents([]);setDiscoverError(error.message||"Could not load local events.");setResultDiagnostics(null);}
    finally{setDiscoverBusy(false);}
  };
  const searchLocalEvents=async()=>{
    const cities=discoverCities.length?discoverCities:(discoverLocation?[discoverLocation]:[]);
    await runSearch(cities);
  };
  const retryFailedCities=async()=>{
    const failures=Array.isArray(resultDiagnostics?.failedCities)?resultDiagnostics.failedCities.map((entry)=>entry.city).filter(Boolean):[];
    if(!failures.length) return;
    await runSearch(failures);
  };
  const addDiscoveredEvent=(event)=>{
    const start=new Date((event.startTime||"").replace(" ","T"));
    const end=new Date((event.endTime||"").replace(" ","T"));
    const validStart=!Number.isNaN(start.getTime());
    const validEnd=!Number.isNaN(end.getTime());
    setDraft({
      title:event.name||"",
      date:validStart?iso(start):selectedDate,
      start:validStart?`${String(start.getHours()).padStart(2,"0")}:${String(start.getMinutes()).padStart(2,"0")}`:"18:00",
      end:validEnd?`${String(end.getHours()).padStart(2,"0")}:${String(end.getMinutes()).padStart(2,"0")}`:"19:00",
      location:event.venue?.address||event.venue?.name||"",
      memberIds:members.map(member=>member.id),
      eventType:"activity",
      destination:"family",
    });
    setSaveError("");setDiscovering(false);setAdding(true);
  };
  const save=async()=>{if(!draft.title.trim())return;setSaving(true);setSaveError("");const payload={title:draft.title.trim(),start:new Date(`${draft.date}T${draft.start}:00`).toISOString(),end:new Date(`${draft.date}T${draft.end}:00`).toISOString(),location:draft.location,memberIds:draft.memberIds,eventType:draft.eventType};try{if(draft.destination.startsWith("google:"))await addGoogleCalendarEvent({...payload,calendarId:draft.destination.slice(7)});else await addEvent(payload);setAdding(false);}catch(error){setSaveError(error.message||"Could not save this event.");}finally{setSaving(false);}};
  const confirmDelete=async()=>{if(!deleteTarget)return;await removeEvent(deleteTarget.id);setDeleteTarget(null);if(selectedEvent?.id===deleteTarget.id)setSelectedEvent(null);};

  const refreshAll = async () => {
    await refreshData();
    if (googleConnected) await syncGoogleCalendarNow();
  };

  return <PullToRefresh onRefresh={refreshAll}><div className="pb-28 reference-calendar">
    <PageHeader title="Everyone’s where, when." illustration="calendar" subtitle={`${dayEvents.length} thing${dayEvents.length===1?"":"s"} on deck for this day.`} action={events.length?<button className="page-reset-button" onClick={()=>setClearing(true)}><Trash2/> Reset</button>:null} />
    <div className="px-5">
      <div className="calendar-tools-row">
        <div className="calendar-source-filters" aria-label="Calendars">{sources.map(source=><button key={source.id} className={sourceFilter===source.id?"selected":""} onClick={()=>setSourceFilter(source.id)}>{source.color&&<i style={{backgroundColor:source.color}}/>}{source.label}</button>)}<button className="calendar-settings-link" onClick={()=>{window.location.hash="settings";}}><Settings2 size={13}/> Manage</button></div>
        <button className="discover-events-button" onClick={()=>{setDiscovering(true);setDiscoverCities((current)=>current.length?current:(discoverLocation?[discoverLocation]:[]));if(!discoveredEvents.length)window.setTimeout(searchLocalEvents,0);}}><Ticket/> Discover</button>
      </div>
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
    <Modal open={discovering} onClose={()=>setDiscovering(false)} title="Find something fun nearby">
      <div className="event-discovery-intro"><span><Sparkles/></span><div><strong>{searchCities.length ? `Searching ${searchCities.length} area${searchCities.length===1?"":"s"}` : "Add your home area"}</strong>          <p>Fresh local events and experiences for your family, powered by SerpApi (Google Events).</p></div></div>
      <div className="event-city-picker">
        <span>Search areas</span>
        <div className="event-city-chips">
          {searchCities.map((city)=><button type="button" className="event-city-chip" key={city} onClick={()=>removeCity(city)} aria-label={`Remove ${city}`}>{city}<X/></button>)}
          <input value={cityDraft} onChange={(event)=>setCityDraft(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"){event.preventDefault();addCity();}}} placeholder="Add a city or town" aria-label="Add a city to search" />
          <button type="button" className="event-city-add" onClick={()=>addCity()} disabled={!cityDraft.trim()}><Plus/> Add</button>
        </div>
        <small>Add nearby cities to widen the search radius. Results merge across every area.</small>
      </div>
      <div className="event-discovery-controls">
        <label><span>What sounds good?</span><select value={discoverCategory} onChange={event=>setDiscoverCategory(event.target.value)}><option>family events</option><option>kids activities</option><option>festivals</option><option>sports events</option><option>concerts</option><option>workshops</option><option>outdoor activities</option><option>museums and exhibits</option></select></label>
        <label><span>When?</span><select value={discoverWhen} onChange={event=>setDiscoverWhen(event.target.value)}><option>today</option><option>tomorrow</option><option>this weekend</option><option>next weekend</option><option>this month</option></select></label>
        <button onClick={searchLocalEvents} disabled={discoverBusy}><Search/>{discoverBusy?"Looking nearby…":"Search"}</button>
      </div>
      {discoverBusy&&<div className="event-discovery-loading"><LoaderCircle/> Finding ideas near your family…</div>}
      {discoverError&&<div className="event-discovery-error">{discoverError}{!discoverLocation&&<button onClick={()=>{setDiscovering(false);window.location.hash="settings";}}>Open Settings</button>}<button className="event-discovery-retry" onClick={searchLocalEvents}>{discoverBusy?"Retrying…":"Try again"}</button></div>}
      {!discoverBusy&&discoveredEvents.length>0&&<>
        {resultDiagnostics?.failedCities?.length>0&&(
          <div className="event-discovery-partial-warning" role="status">
            <span aria-hidden="true"><TriangleAlert size={16}/></span>
            <div>
              <strong>{formatCityFailure(resultDiagnostics.failedCities)}</strong>
              <small>Showing events from the {resultDiagnostics.succeededCities?.length||0} other area{(resultDiagnostics.succeededCities?.length||0)===1?"":"s"} you searched.</small>
            </div>
            <button type="button" className="event-discovery-retry-city" onClick={retryFailedCities}><Search aria-hidden="true" size={14}/> Retry {resultDiagnostics.failedCities.length===1?"that area":"those areas"}</button>
          </div>
        )}
        <div className="discovered-event-list">
          {discoveredEvents.map(event=>(
            <article key={event.id}>
              <div className="discovered-event-thumb">
                {event.thumbnail
                  ? <img src={event.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  : <Ticket aria-hidden="true" />}
              </div>
              <div className="discovered-event-copy">
                <div>
                  <span>{event.dateLabel || (event.startTime ? new Date(event.startTime.replace(" ", "T")).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" }) : "Date varies")}</span>
                  {event.ticketSource && <small><Ticket aria-hidden="true"/> {event.ticketSource}</small>}
                </div>
                <h3>{event.name}</h3>
                <p>{event.description || "Open the event page for details."}</p>
                <b><MapPin aria-hidden="true"/>{event.virtual ? "Online event" : event.venue?.name || event.venue?.city || searchCities[0] || discoverLocation}</b>
                <footer>
                  <button type="button" onClick={()=>addDiscoveredEvent(event)}><CalendarPlus aria-hidden="true"/> Add to calendar</button>
                  {event.link && <a href={event.link} target="_blank" rel="noreferrer">View details <ExternalLink aria-hidden="true"/></a>}
                </footer>
              </div>
            </article>
          ))}
        </div>
      </>}
      <small className="event-discovery-source">Event details come from public web sources and may change. Confirm times, availability, suitability, and prices with the event provider before making plans.</small>
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
  </div></PullToRefresh>;
}
