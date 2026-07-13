import { FAMILY_COLORS } from "../data/mockData";

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
      className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold text-white shrink-0 ring-2 ring-white`}
      style={{ backgroundColor: colorVar(member.color) }}
      title={member.name}
    >
      {member.initials}
    </div>
  );
}

export function AvatarStack({ members, size = "sm" }) {
  if (!members?.length) return null;
  return (
    <div className="flex -space-x-1.5">
      {members.map((m) => (
        <Avatar key={m.id} member={m} size={size} />
      ))}
    </div>
  );
}

export function Tag({ children, color, tone = "neutral" }) {
  if (color) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
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
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "", as: As = "div", ...props }) {
  return (
    <As
      className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl ${className}`}
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
        <h2 className="font-[var(--font-display)] text-[17px] font-semibold text-[var(--color-ink)]">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function Checkbox({ checked, onChange, color }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className="relative w-[22px] h-[22px] rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-colors duration-150"
      style={{
        borderColor: checked ? (color ? colorVar(color) : "var(--color-accent)") : "var(--color-border-strong)",
        backgroundColor: checked ? (color ? colorVar(color) : "var(--color-accent)") : "transparent",
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-[var(--color-surface)] w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl p-5 pb-8 sm:pb-6 safe-bottom fade-up max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-[var(--color-border-strong)] rounded-full mx-auto mb-4 sm:hidden" />
        {title && <h3 className="font-[var(--font-display)] text-[17px] font-semibold mb-4">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function TextField({ label, ...props }) {
  return (
    <label className="block mb-3">
      {label && <span className="block text-[12.5px] font-medium text-[var(--color-ink-soft)] mb-1.5">{label}</span>}
      <input
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3.5 py-2.5 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
        {...props}
      />
    </label>
  );
}

export function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      className={`w-full rounded-xl bg-[var(--color-accent)] text-white font-semibold text-[15px] py-3 active:scale-[0.98] transition-transform disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...props }) {
  return (
    <button
      className={`w-full rounded-xl border border-[var(--color-border)] text-[var(--color-ink)] font-medium text-[15px] py-3 active:scale-[0.98] transition-transform ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99 }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] px-1.5 py-1.5 w-fit">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[18px] font-medium text-[var(--color-ink)] bg-[var(--color-surface-sunken)] active:scale-95 transition-transform"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="w-6 text-center text-[15px] font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[18px] font-medium text-[var(--color-ink)] bg-[var(--color-surface-sunken)] active:scale-95 transition-transform"
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
