import PageSpotIllustration from "./PageSpotIllustration";

export default function PageHeader({ eyebrow, title, titleIcon, subtitle, action, illustration, liveHealth }) {
  return (
    <header className="page-header m3-page-header safe-top">
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
        {(illustration||action)&&<div className="page-header-aside">{illustration&&<PageSpotIllustration variant={illustration}/>} {action}</div>}
      </div>
    </header>
  );
}
