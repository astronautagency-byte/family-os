import { familyArtProps } from './FamilyIllustration';
export default function PageSpotIllustration({ variant = "calendar" }) {
  return <span className={`page-spot-frame page-spot-frame-${variant}`} aria-hidden="true"><img className={`page-spot page-spot-${variant}`} {...familyArtProps(variant)} sizes="88px" loading="lazy" decoding="async" alt="" /></span>;
}
