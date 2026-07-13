export default function PageHeader({ eyebrow, title, titleIcon, subtitle, action }) {
  return (
    <header className="px-5 pt-4 pb-2 safe-top">
      <div className="flex items-start justify-between gap-3">
        <div>
          {eyebrow && (
            <p className="text-[12px] font-medium text-[var(--color-ink-faint)] mb-0.5">{eyebrow}</p>
          )}
          <h1 className="font-[var(--font-display)] text-[26px] font-bold tracking-tight text-[var(--color-ink)] flex items-center gap-2">
            {titleIcon}
            {title}
          </h1>
          {subtitle && <p className="text-[13.5px] text-[var(--color-ink-soft)] mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
