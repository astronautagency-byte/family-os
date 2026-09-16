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
import {HouseholdFeaturesProvider} from "./context/HouseholdFeaturesContext";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { setupSelfUpdate } from "./lib/selfUpdate.js";

setupSelfUpdate();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <HouseholdFeaturesProvider><App /></HouseholdFeaturesProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
);
