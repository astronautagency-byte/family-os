export default function PageHeader({ eyebrow, title, titleIcon, subtitle, action }) {
  return (
    <header className="page-header px-5 pb-4 safe-top">
      <div className="page-header-content flex items-start justify-between gap-3">
        <div>
          {eyebrow && (
            <p className="text-[12px] font-medium text-[var(--color-ink-faint)] mb-0.5">{eyebrow}</p>
          )}
          <h1 className="page-title font-[var(--font-display)] text-[30px] font-semibold tracking-[-0.035em] text-[var(--color-ink)] flex items-center gap-2">
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
