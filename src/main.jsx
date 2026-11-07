import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./theme/component-consistency.css";
import "./theme/illustrated-ui.css";
import "./theme/page-layout.css";
import "./theme/reference-screens.css";
import "./theme/product-feedback.css";
import "./theme/ux-refinements.css";
import "./theme/contrast.css";
import "./theme/scheme-accents.css";
import "./theme/spacing.css";
import "./theme/dark-mode.css";
import "./theme/app-polish.css";
import {HouseholdFeaturesProvider} from "./context/HouseholdFeaturesContext";
import App from "./App.jsx";
import {IS_APP_STORE} from "./lib/distribution";
import { AuthProvider } from "./context/AuthContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { setupSelfUpdate } from "./lib/selfUpdate.js";

setupSelfUpdate();

const publicPath = window.location.pathname.replace(/\/$/, '') || '/';
const publicFeatureRoute = publicPath === '/features' || publicPath.startsWith('/features/') || ['/calendar-sync','/calendar-photo-import'].includes(publicPath);
if (!IS_APP_STORE && publicPath === '/' && window.location.hostname === 'fam-os.app') {
  import('./pages/Landing.jsx').then(({default:Landing}) => createRoot(document.getElementById('root')).render(<StrictMode><Landing/></StrictMode>));
} else if (!IS_APP_STORE && publicFeatureRoute) {
  import('./pages/MarketingFeatures.jsx').then(({default:MarketingFeatures}) => {
    createRoot(document.getElementById('root')).render(<StrictMode><MarketingFeatures path={publicPath}/></StrictMode>);
  });
} else {
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <HouseholdFeaturesProvider><App /></HouseholdFeaturesProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
);

}
