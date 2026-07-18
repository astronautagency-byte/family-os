import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { fetchGooglePlaceSuggestions, googleMapsApiKey, loadGooglePlaces } from "../lib/googleMapsPlaces";

function addressParts(result) {
  const components = result?.address_components || [];
  const part = (type) => components.find((component) => component.types?.includes(type))?.long_name || "";
  return {
    address: result?.formatted_address || "",
    city: part("locality") || part("postal_town") || part("administrative_area_level_2"),
    region: part("administrative_area_level_1"),
    postalCode: part("postal_code"),
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
  const resolvedAddressRef = useRef("");

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

  const resolveAddress = async (description, placeId) => {
    if (!maps || !description?.trim()) return;
    try {
      const geocoder = new maps.google.maps.Geocoder();
      const response = await geocoder.geocode({
        ...(placeId ? { placeId } : { address: description.trim() }),
      });
      const details = addressParts(response.results?.[0]);
      resolvedAddressRef.current = details.address || description;
      onChange({ ...details, address: details.address || description });
      setStatus("");
    } catch (error) {
      setStatus(error?.message || "Choose an address suggestion so FamOS can find local weather.");
    }
  };

  const select = async (suggestion) => {
    const prediction = suggestion.placePrediction;
    const description = prediction?.text?.toString?.() || prediction?.legacyPrediction?.description || "";
    setSuggestions([]);
    if (!description) return;
    await resolveAddress(description, prediction?.placeId || prediction?.legacyPrediction?.place_id);
  };

  const handleBlur = () => {
    window.setTimeout(() => setSuggestions([]), 150);
    const address = value.trim();
    if (maps && address.length >= 3 && address !== resolvedAddressRef.current) {
      resolveAddress(address);
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
          onChange={(event) => {
            resolvedAddressRef.current = "";
            onChange({
              address: event.target.value,
              city: "",
              region: "",
              postalCode: "",
              country: "",
              latitude: null,
              longitude: null,
            });
          }}
          onBlur={handleBlur}
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
