import PageAddButton from './PageAddButton';
import FamilyIllustration, { FAMILY_ART } from './FamilyIllustration';

export default function PageHeader({ eyebrow, title, titleIcon, subtitle, action, illustration, liveHealth, onAdd, addLabel = 'Add item' }) {
  return (
    <header className={`page-header m3-page-header safe-top ${illustration ? `page-header-${illustration} has-illustration` : ""}`}>
      <div className="page-header-content">
        <div className="min-w-0">
          {eyebrow && (
            <p className="page-eyebrow">{eyebrow}</p>
          )}
          <h1 className="page-title flex items-center gap-2">
            {titleIcon}
            {title}
          </h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
          {liveHealth && <div className="page-header-live">{liveHealth}</div>}
        </div>
        {(onAdd||action||FAMILY_ART[illustration])&&<div className="page-header-aside">{FAMILY_ART[illustration] && <FamilyIllustration variant={illustration} className="family-header-art" />}{action}{onAdd && <PageAddButton label={addLabel} onClick={onAdd}/>}</div>}
      </div>
    </header>
  );
}
