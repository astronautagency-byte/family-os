import { FAMILY_COLORS } from "../data/mockData";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, X } from "lucide-react";

export function colorVar(colorId) {
  const found = FAMILY_COLORS.find((c) => c.id === colorId);
  return found ? found.value : "var(--color-ink-faint)";
}

export function Avatar({ member, size = "md" }) {
  if (!member) return null;
  const sizes = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-xs",
    lg: "w-11 h-11 text-sm",
  };
  return (
    <div
      className={`${sizes[size]} relative overflow-hidden rounded-full flex items-center justify-center font-semibold text-white shrink-0 ring-2 ring-white`}
      style={{ backgroundColor: member.avatarUrl ? "#fff" : colorVar(member.color) }}
      title={member.name}
    >
      {member.initials}
      {member.avatarUrl && (
        <img
          src={member.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(event) => { event.currentTarget.style.display = "none"; }}
        />
      )}
    </div>
  );
}

export function AvatarStack({ members, size = "sm" }) {
  if (!members?.length) return null;
  return (
    <div className="flex -space-x-1.5">
      {members.map((m, index) => (
        <Avatar key={`${m.id}-${index}`} member={m} size={size} />
      ))}
    </div>
  );
}

export function Tag({ children, color, tone = "neutral" }) {
  if (color) {
    return (
      <span
        className="m3-chip inline-flex items-center gap-1.5"
        style={{ backgroundColor: `color-mix(in srgb, ${colorVar(color)} 16%, white)`, color: colorVar(color) }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorVar(color) }} />
        {children}
      </span>
    );
  }
  const tones = {
    neutral: "bg-[var(--color-surface-sunken)] text-[var(--color-ink-soft)]",
    accent: "bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]",
    warn: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
    good: "bg-[var(--color-good-soft)] text-[var(--color-good)]",
  };
  return (
    <span className={`m3-chip inline-flex items-center ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "", as: As = "div", ...props }) {
  return (
    <As
      className={`kinship-card m3-card bg-[var(--color-surface)] border border-[var(--color-border)] ${className}`}
      {...props}
    >
      {children}
    </As>
  );
}

export function SectionTitle({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-semibold tracking-wide uppercase text-[var(--color-ink-faint)] mb-0.5">
            {eyebrow}
          </p>
        )}
        <h2 className="ui-section-title">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function Checkbox({ checked, onChange, color, label = "Toggle selection" }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      aria-label={label}
      className="m3-checkbox relative flex items-center justify-center shrink-0"
      style={{
        "--checkbox-color": color ? colorVar(color) : "var(--color-accent)",
      }}
    >
      {checked && (
        <svg
          className="check-pop"
          width="12" height="12" viewBox="0 0 12 12" fill="none"
        >
          <path d="M2 6.2L4.7 9L10 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="m3-dialog-layer fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="presentation">
      <div className="m3-scrim absolute inset-0" onClick={onClose} />
      <div className="modal-card m3-dialog relative bg-[var(--color-surface)] w-full sm:max-w-sm px-7 pt-7 pb-12 sm:p-8 safe-bottom fade-up max-h-[85vh] overflow-y-auto" role="dialog" aria-modal="true" aria-label={title || "Dialog"}>
        <button type="button" className="modal-close-button" onClick={onClose} aria-label="Close dialog"><X size={17} /></button>
        <div className="w-10 h-1 bg-[var(--color-border-strong)] rounded-full mx-auto mb-4 sm:hidden" />
        {title && <h3 className="font-[var(--font-display)] text-[19px] font-semibold mb-5 pr-10">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function TextField({ label, ...props }) {
  return (
    <label className="form-field">
      {label && <span className="form-label">{label}</span>}
      <input
        className="form-control"
        {...props}
      />
    </label>
  );
}

const DATE_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const dateIso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parseDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : new Date();
};
const sameDay = (left, right) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();

export function DateField({ label, value, onChange, min, max, disabled = false }) {
  const rootRef = useRef(null);
  const selectedDate = useMemo(() => parseDate(value), [value]);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  useEffect(() => {
    if (open) setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [open, selectedDate]);

  const start = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  start.setDate(start.getDate() - start.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
  const minDate = min ? parseDate(min) : null;
  const maxDate = max ? parseDate(max) : null;
  const today = new Date();

  const choose = (day) => {
    onChange(dateIso(day));
    setOpen(false);
  };

  return (
    <div className="form-field date-field" ref={rootRef}>
      {label && <span className="form-label">{label}</span>}
      <button type="button" className={`form-control date-trigger ${open ? "is-open" : ""}`} disabled={disabled} onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <CalendarDays size={17} />
        <span>{value ? selectedDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Choose a date"}</span>
        <ChevronRight size={15} />
      </button>
      {open && (
        <div className="date-popover" role="dialog" aria-label="Choose a date">
          <div className="date-popover-head">
            <button type="button" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={17} /></button>
            <strong>{visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
            <button type="button" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={17} /></button>
          </div>
          <div className="date-weekdays">{DATE_WEEKDAYS.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
          <div className="date-grid">
            {days.map((day) => {
              const isoValue = dateIso(day);
              const unavailable = (minDate && day < minDate) || (maxDate && day > maxDate);
              const selected = value && sameDay(day, selectedDate);
              return (
                <button
                  type="button"
                  key={isoValue}
                  disabled={unavailable}
                  className={`${day.getMonth() === visibleMonth.getMonth() ? "" : "outside"} ${sameDay(day, today) ? "today" : ""} ${selected ? "selected" : ""}`}
                  onClick={() => choose(day)}
                  aria-label={day.toLocaleDateString()}
                  aria-pressed={Boolean(selected)}
                >
                  {day.getDate()}{selected && <Check size={11} />}
                </button>
              );
            })}
          </div>
          <div className="date-popover-foot">
            <button type="button" onClick={() => choose(today)}>Today</button>
            {value && <button type="button" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>}
          </div>
        </div>
      )}
    </div>
  );
}

export function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      className={`primary-button-row m3-button m3-button-filled w-full ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...props }) {
  return (
    <button
      className={`m3-button m3-button-outlined w-full ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99 }) {
  return (
    <div className="m3-stepper">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="m3-stepper-button"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="m3-stepper-value">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="m3-stepper-button"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && <div className="mb-3 text-[var(--color-ink-faint)]">{icon}</div>}
      <p className="font-medium text-[var(--color-ink)] mb-1">{title}</p>
      {subtitle && <p className="text-sm text-[var(--color-ink-soft)] max-w-[26ch]">{subtitle}</p>}
    </div>
  );
}
