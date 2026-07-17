const GOOGLE_MAPS_SCRIPT_ID = "family-os-google-maps-places";

let googleMapsPromise;

export const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export function loadGooglePlaces() {
  if (!googleMapsApiKey) {
    return Promise.reject(new Error("Google Maps API key is not configured."));
  }

  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Could not load Google Maps.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}&libraries=places&v=weekly`;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Could not load Google Maps."));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
