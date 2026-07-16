import PageSpotIllustration from "./PageSpotIllustration";

export default function PageHeader({ eyebrow, title, titleIcon, subtitle, action, illustration }) {
  return (
    <header className="page-header px-5 pb-4 safe-top">
      <div className="page-header-content flex items-center justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="page-eyebrow">{eyebrow}</p>
          )}
          <h1 className="page-title flex items-center gap-2">
            {titleIcon}
            {title}
          </h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {(illustration||action)&&<div className="page-header-aside">{illustration&&<PageSpotIllustration variant={illustration}/>} {action}</div>}
      </div>
    </header>
  );
}
