import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { fetchGooglePlaceSuggestions, googleMapsApiKey, loadGooglePlaces } from "../lib/googleMapsPlaces";

function addressParts(result) {
  const components = result?.address_components || [];
  const part = (type) => components.find((component) => component.types?.includes(type))?.long_name || "";
  return {
    address: result?.formatted_address || "",
    city: part("locality") || part("postal_town") || part("administrative_area_level_2"),
    country: part("country"),
    latitude: result?.geometry?.location?.lat?.() ?? null,
    longitude: result?.geometry?.location?.lng?.() ?? null,
  };
}

export default function AddressAutocomplete({ label = "Home address", value = "", onChange, placeholder = "Start typing your address" }) {
  const [suggestions, setSuggestions] = useState([]);
  const [maps, setMaps] = useState(null);
  const [status, setStatus] = useState("");
  const requestRef = useRef(0);
  const sessionTokenRef = useRef(null);

  useEffect(() => {
    loadGooglePlaces()
      .then((loaded) => {
        setMaps(loaded);
        sessionTokenRef.current = loaded.places?.AutocompleteSessionToken ? new loaded.places.AutocompleteSessionToken() : undefined;
      })
      .catch((error) => setStatus(error.message || "Address suggestions are unavailable."));
  }, []);

  useEffect(() => {
    const input = value.trim();
    if (!maps || input.length < 3) {
      setSuggestions([]);
      return undefined;
    }
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const results = await fetchGooglePlaceSuggestions({ ...maps, input, sessionToken: sessionTokenRef.current });
        if (requestId === requestRef.current) setSuggestions(results.slice(0, 6));
      } catch (error) {
        if (requestId === requestRef.current) setStatus(error.message || "Address suggestions are unavailable.");
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [maps, value]);

  const select = async (suggestion) => {
    const prediction = suggestion.placePrediction;
    const description = prediction?.text?.toString?.() || prediction?.legacyPrediction?.description || "";
    setSuggestions([]);
    if (!description) return;
    try {
      const geocoder = new maps.google.maps.Geocoder();
      const response = await geocoder.geocode({
        placeId: prediction?.placeId || prediction?.legacyPrediction?.place_id,
        address: description,
      });
      const details = addressParts(response.results?.[0]);
      onChange({ ...details, address: details.address || description });
      setStatus("");
    } catch {
      onChange({ address: description });
    }
  };

  return (
    <label className="form-field address-autocomplete">
      <span className="form-label">{label}</span>
      <span className="address-autocomplete-control">
        <MapPin size={17} />
        <input
          className="form-control"
          value={value}
          placeholder={placeholder}
          autoComplete="street-address"
          onChange={(event) => onChange({ address: event.target.value })}
          onBlur={() => window.setTimeout(() => setSuggestions([]), 150)}
        />
      </span>
      {suggestions.length > 0 && <span className="address-autocomplete-results">
        {suggestions.map((suggestion, index) => {
          const prediction = suggestion.placePrediction;
          const text = prediction?.text?.toString?.() || prediction?.legacyPrediction?.description || "";
          return <button type="button" key={prediction?.placeId || prediction?.legacyPrediction?.place_id || `${text}-${index}`} onMouseDown={(event) => event.preventDefault()} onClick={() => select(suggestion)}><MapPin size={15} /><span>{text}</span></button>;
        })}
      </span>}
      {!googleMapsApiKey && <small className="address-autocomplete-warning">Google Maps is not configured for this deployment.</small>}
      {status && googleMapsApiKey && <small className="address-autocomplete-warning">{status}</small>}
    </label>
  );
}
