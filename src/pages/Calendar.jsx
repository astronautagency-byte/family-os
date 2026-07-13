import { useMemo, useState } from "react";
import { CalendarPlus, MapPin, Plus } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { AvatarStack, Card, EmptyState, Modal, PrimaryButton, TextField, colorVar } from "../components/ui";
import PageHeader from "../components/PageHeader";
import { addDays, formatTime, fullDateLabel, todayISO } from "../lib/dates";

const GOOGLE_BLUE = "#191919";

function startOfWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0 = Sun
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export default function CalendarPage({ goTo }) {
  const { members, memberById, events, addEvent, googleConnected, googleEvents } = useFamily();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [activeFilters, setActiveFilters] = useState([]); // memberIds; empty = show all
  const [showGoogle, setShowGoogle] = useState(true);
  const [weekAnchor, setWeekAnchor] = useState(startOfWeek(todayISO()));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", date: todayISO(), start: "18:00", end: "19:00", location: "", memberIds: [] });

  const openAdd = () => {
    setDraft({ title: "", date: selectedDate, start: "18:00", end: "19:00", location: "", memberIds: members.map((m) => m.id) });
    setAdding(true);
  };

  const submitEvent = () => {
    if (!draft.title.trim()) return;
    addEvent({
      title: draft.title.trim(),
      start: new Date(`${draft.date}T${draft.start}:00`).toISOString(),
      end: new Date(`${draft.date}T${draft.end}:00`).toISOString(),
      location: draft.location.trim(),
      memberIds: draft.memberIds,
    });
    setSelectedDate(draft.date);
    setWeekAnchor(startOfWeek(draft.date));
    setAdding(false);
  };

  const allEvents = useMemo(
    () => [...events, ...(showGoogle ? googleEvents : [])],
    [events, googleEvents, showGoogle]
  );

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)),
    [weekAnchor]
  );

  const toggleFilter = (id) =>
    setActiveFilters((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const dayEvents = allEvents
    .filter((e) => e.start.slice(0, 10) === selectedDate)
    .filter((e) => activeFilters.length === 0 || (e.memberIds || []).some((id) => activeFilters.includes(id)))
    .sort((a, b) => a.start.localeCompare(b.start));

  const countsByDay = useMemo(() => {
    const map = {};
    for (const day of weekDays) {
      map[day] = allEvents.filter(
        (e) =>
          e.start.slice(0, 10) === day &&
          (activeFilters.length === 0 || (e.memberIds || []).some((id) => activeFilters.includes(id)))
      ).length;
    }
    return map;
  }, [weekDays, allEvents, activeFilters]);

  return (
    <div className="pb-24">
      <PageHeader eyebrow="Family" title="Calendar" />

      {/* Member + Google filter chips */}
      <div className="px-5 mt-1 mb-3 flex gap-2 overflow-x-auto pb-1">
        {members.map((m) => {
          const active = activeFilters.includes(m.id);
          return (
            <button
              key={m.id}
              onClick={() => toggleFilter(m.id)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium border shrink-0 transition-colors"
              style={{
                borderColor: active ? colorVar(m.color) : "var(--color-border)",
                backgroundColor: active ? `color-mix(in srgb, ${colorVar(m.color)} 14%, white)` : "var(--color-surface)",
                color: active ? colorVar(m.color) : "var(--color-ink-soft)",
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorVar(m.color) }} />
              {m.name}
            </button>
          );
        })}
        {googleConnected && (
          <button
            onClick={() => setShowGoogle((v) => !v)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium border shrink-0 transition-colors"
            style={{
              borderColor: showGoogle ? GOOGLE_BLUE : "var(--color-border)",
              backgroundColor: showGoogle ? "var(--color-surface-sunken)" : "var(--color-surface)",
              color: showGoogle ? GOOGLE_BLUE : "var(--color-ink-soft)",
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: GOOGLE_BLUE }} />
            Google
          </button>
        )}
      </div>

      {!googleConnected && (
        <div className="px-5 mb-4">
          <button onClick={() => goTo?.("settings")} className="w-full text-left">
            <Card className="p-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0">
                <CalendarPlus size={17} color="var(--color-accent)" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium text-[var(--color-ink)]">Connect Google Calendar</p>
                <p className="text-[12px] text-[var(--color-ink-soft)]">Pull your events in from Settings</p>
              </div>
            </Card>
          </button>
        </div>
      )}

      {/* Week strip */}
      <div className="px-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <button
            className="text-[12.5px] font-medium text-[var(--color-accent)]"
            onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}
          >
            ← Prev
          </button>
          <button
            className="text-[12.5px] font-medium text-[var(--color-ink-soft)]"
            onClick={() => {
              setWeekAnchor(startOfWeek(todayISO()));
              setSelectedDate(todayISO());
            }}
          >
            Today
          </button>
          <button
            className="text-[12.5px] font-medium text-[var(--color-accent)]"
            onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}
          >
            Next →
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((day) => {
            const d = new Date(day + "T00:00:00");
            const isSelected = day === selectedDate;
            const isToday = day === todayISO();
            return (
              <button
                key={day}
                onClick={() => setSelectedDate(day)}
                className="flex flex-col items-center py-2 rounded-xl transition-colors"
                style={{
                  backgroundColor: isSelected ? "var(--color-accent)" : "var(--color-surface)",
                  border: `1px solid ${isSelected ? "var(--color-accent)" : "var(--color-border)"}`,
                }}
              >
                <span
                  className="text-[10px] font-semibold uppercase"
                  style={{ color: isSelected ? "rgba(255,255,255,0.75)" : "var(--color-ink-faint)" }}
                >
                  {d.toLocaleDateString(undefined, { weekday: "narrow" })}
                </span>
                <span
                  className="text-[15px] font-semibold mt-0.5"
                  style={{ color: isSelected ? "white" : "var(--color-ink)" }}
                >
                  {d.getDate()}
                </span>
                <span
                  className="w-1 h-1 rounded-full mt-1"
                  style={{
                    backgroundColor: countsByDay[day] > 0 ? (isSelected ? "white" : "var(--color-accent)") : "transparent",
                  }}
                />
                {isToday && !isSelected && (
                  <span className="absolute mt-[42px] w-1 h-1 rounded-full bg-[var(--color-accent)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day agenda */}
      <div className="px-5">
        <p className="text-[13px] font-medium text-[var(--color-ink-soft)] mb-2">{fullDateLabel(selectedDate)}</p>
        <Card className="p-1">
          {dayEvents.length === 0 ? (
            <EmptyState title="No events" subtitle="This day is wide open." />
          ) : (
            <ul>
              {dayEvents.map((ev) => {
                const evMembers = (ev.memberIds || []).map((id) => memberById[id]).filter(Boolean);
                const isGoogle = ev.source === "google";
                return (
                  <li key={ev.id} className="flex gap-3 px-3 py-3 border-b border-[var(--color-border)] last:border-0">
                    <div
                      className="w-1 rounded-full self-stretch shrink-0"
                      style={{
                        backgroundColor: isGoogle
                          ? GOOGLE_BLUE
                          : evMembers[0]
                          ? colorVar(evMembers[0].color)
                          : "var(--color-border-strong)",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-[14.5px] text-[var(--color-ink)] truncate">{ev.title}</p>
                        {isGoogle && (
                          <span
                            className="text-[9.5px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
                            style={{ color: GOOGLE_BLUE, backgroundColor: "var(--color-surface-sunken)" }}
                          >
                            Google
                          </span>
                        )}
                      </div>
                      <p className="text-[12.5px] text-[var(--color-ink-soft)] mt-0.5">
                        {formatTime(ev.start)} – {formatTime(ev.end)}
                      </p>
                      {ev.location && (
                        <p className="text-[12.5px] text-[var(--color-ink-soft)] flex items-center gap-1 mt-0.5">
                          <MapPin size={11} /> {ev.location}
                        </p>
                      )}
                    </div>
                    <AvatarStack members={evMembers} size="sm" />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <button
        onClick={openAdd}
        className="fixed bottom-24 right-5 w-13 h-13 rounded-full bg-[var(--color-accent)] shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        style={{ width: 52, height: 52 }}
        aria-label="Add event"
      >
        <Plus color="white" size={24} />
      </button>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add to schedule">
        <TextField label="Event" placeholder="e.g. Dinner reservation" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} autoFocus />
        <div className="grid grid-cols-3 gap-2 mb-4">
          <label className="col-span-3 text-[12.5px] font-medium text-[var(--color-ink-soft)]">
            Date
            <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-[14px]" />
          </label>
          <label className="text-[12.5px] font-medium text-[var(--color-ink-soft)] col-span-1">
            Starts
            <input type="time" value={draft.start} onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-white px-2 py-2.5 text-[14px]" />
          </label>
          <label className="text-[12.5px] font-medium text-[var(--color-ink-soft)] col-span-2">
            Ends
            <input type="time" value={draft.end} onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-[14px]" />
          </label>
        </div>
        <TextField label="Location (optional)" placeholder="e.g. Home" value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} />
        <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-2">Who is going?</p>
        <div className="flex gap-2 mb-5">
          {members.map((m) => {
            const selected = draft.memberIds.includes(m.id);
            return <button key={m.id} type="button" onClick={() => setDraft((d) => ({ ...d, memberIds: selected ? d.memberIds.filter((id) => id !== m.id) : [...d.memberIds, m.id] }))} className="rounded-full px-3 py-1.5 text-[13px] font-medium border" style={{ borderColor: selected ? colorVar(m.color) : "var(--color-border)", color: selected ? colorVar(m.color) : "var(--color-ink-soft)", background: selected ? `color-mix(in srgb, ${colorVar(m.color)} 14%, white)` : "white" }}>{m.name}</button>;
          })}
        </div>
        <PrimaryButton onClick={submitEvent} disabled={!draft.title.trim()}>Add event</PrimaryButton>
      </Modal>
    </div>
  );
}
