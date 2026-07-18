const GOOGLE_MAPS_SCRIPT_ID = "family-os-google-maps-places";

let googleMapsPromise;

export const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

async function ensurePlacesLibrary(google) {
  if (!google?.maps) throw new Error("Could not load Google Maps.");
  const places = typeof google.maps.importLibrary === "function"
    ? await google.maps.importLibrary("places")
    : google.maps.places;
  if (!places) throw new Error("Could not load Google Maps places.");
  return { google, places };
}

export function loadGooglePlaces() {
  if (!googleMapsApiKey) {
    return Promise.reject(new Error("Google Maps API key is not configured."));
  }

  if (window.google?.maps) return ensurePlacesLibrary(window.google);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const finishLoading = () => {
      ensurePlacesLibrary(window.google).then(resolve).catch(reject);
    };
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", finishLoading, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Could not load Google Maps.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    // Do not use loading=async with an onload-based loader. With that flag the
    // script element can finish before the Places library has initialized.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}&libraries=places&v=weekly`;
    script.onload = finishLoading;
    script.onerror = () => reject(new Error("Could not load Google Maps."));
    document.head.appendChild(script);
  }).catch((error) => {
    googleMapsPromise = undefined;
    throw error;
  });

  return googleMapsPromise;
}

function legacyAutocomplete(google, input, sessionToken) {
  const AutocompleteService = google?.maps?.places?.AutocompleteService;
  if (!AutocompleteService) return Promise.reject(new Error("Google Maps autocomplete is unavailable."));

  const service = new AutocompleteService();
  return new Promise((resolve, reject) => {
    service.getPlacePredictions(
      { input, sessionToken },
      (predictions, status) => {
        const ok = google.maps.places.PlacesServiceStatus?.OK || "OK";
        const empty = google.maps.places.PlacesServiceStatus?.ZERO_RESULTS || "ZERO_RESULTS";
        if (status === empty) return resolve([]);
        if (status !== ok) return reject(new Error(`Google Places returned ${status}.`));
        resolve((predictions || []).map((prediction) => ({
          placePrediction: {
            text: { toString: () => prediction.description || "" },
            legacyPrediction: prediction,
          },
        })));
      },
    );
  });
}

export async function fetchGooglePlaceSuggestions({ google, places, input, sessionToken }) {
  if (places?.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
    try {
      const result = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input, sessionToken });
      return result?.suggestions || [];
    } catch (newPlacesError) {
      // Projects created before Places API (New) commonly have only the legacy
      // Places endpoint enabled. Keep autocomplete working during that migration.
      try {
        return await legacyAutocomplete(google, input, sessionToken);
      } catch {
        throw newPlacesError;
      }
    }
  }
  return legacyAutocomplete(google, input, sessionToken);
}
