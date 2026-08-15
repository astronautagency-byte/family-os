import { MARKETING_FEATURES } from "../data/featureData";

/* ── MarketingFooter ──────────────────────────────────────────────────────
 * Single canonical footer for every public marketing surface: Landing,
 * Features index, Features module pages, Privacy, Terms. Replaces the three
 * different footer variants (landing-footer / features-footer / legal-footer)
 * so a new feature module added to featureData.js automatically appears in
 * the footer's feature list. The rightmost "Company" column flips Sign in /
 * Start trial links off once the user is signed in.
 *
 * Styled by the existing .features-footer rules in src/feature.css — dark
 * surface, 4-column grid, bottom row with copyright + secondary nav. ─── */
const MarketingFooter = ({ signedIn = false }) => {
  // Surface the current marketing products in the footer columns; supporting
  // catalog entries remain available as deep links. Split the list evenly so
  // neither column runs off the page on tablet widths.
  const half = Math.ceil(MARKETING_FEATURES.length / 2);
  const featuresCol = MARKETING_FEATURES.slice(0, half);
  const productCol = MARKETING_FEATURES.slice(half);

  return (
    <footer className="features-footer">
      <div className="features-footer-inner">
        <div>
          <h4>FamOS</h4>
          <p>A quieter home for everything your family does together.</p>
        </div>
        <div>
          <h4>Features</h4>
          <ul>
            {featuresCol.map((feature) => (
              <li key={feature.id}>
                <a href={`/features/${feature.id}`}>{feature.name}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Product</h4>
          <ul>
            {productCol.map((feature) => (
              <li key={feature.id}>
                <a href={`/features/${feature.id}`}>{feature.name}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Company</h4>
          <ul>
            <li><a href="/privacy">Privacy</a></li>
            <li><a href="/terms">Terms</a></li>
            {!signedIn && <li><a href="/signin">Sign in</a></li>}
            {!signedIn && <li><a href="/signup">Start trial</a></li>}
            {signedIn && <li><a href="/today">Open FamOS</a></li>}
          </ul>
        </div>
      </div>
      <div className="features-footer-bottom">
        <span>© {new Date().getFullYear()} FamOS, Inc.</span>
        <span><a href="/landing">Home</a> · <a href="/features">All features</a> · <a href="/landing#pricing">Pricing</a></span>
      </div>
    </footer>
  );
};

export default MarketingFooter;
