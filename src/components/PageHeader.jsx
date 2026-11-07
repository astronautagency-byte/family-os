import PageAddButton from './PageAddButton';
import './family-header.css';

export default function PageHeader({ eyebrow, title, titleIcon, subtitle, action, liveHealth, onAdd, addLabel = 'Add item' }) {
  return (
    <header className="page-header m3-page-header safe-top family-page-header">
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
        {(action||onAdd)&&<div className="page-header-aside"><div className="page-header-actions">{action}{onAdd && <PageAddButton label={addLabel} onClick={onAdd}/>}</div></div>}
      </div>
    </header>
  );
}
