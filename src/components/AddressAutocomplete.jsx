import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { fetchGooglePlaceSuggestions, googleMapsApiKey, loadGooglePlaces } from "../lib/googleMapsPlaces";
import { googleAddressParts, googlePredictionText } from "../lib/googleAddress";

function geocodeAddress(maps, request) {
  return new Promise((resolve, reject) => {
    const geocoder = new maps.google.maps.Geocoder();
    geocoder.geocode(request, (results, status) => {
      const ok = maps.google.maps.GeocoderStatus?.OK || "OK";
      if (status === ok && results?.[0]) resolve(results[0]);
      else reject(new Error(status && status !== "ZERO_RESULTS" ? `Google Maps returned ${status}.` : "Google Maps could not resolve this address."));
    });
  });
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

  const resolveAddress = async (description, placeId, prediction) => {
    if (!maps || !description?.trim()) return;
    try {
      let result;
      if (typeof prediction?.toPlace === "function") {
        const place = prediction.toPlace();
        await place.fetchFields({ fields: ["formattedAddress", "addressComponents", "location"] });
        result = place;
      } else {
        result = await geocodeAddress(maps, placeId ? { placeId } : { address: description.trim() });
      }
      const details = googleAddressParts(result);
      if (!Number.isFinite(details.latitude) || !Number.isFinite(details.longitude)) {
        throw new Error("Google Maps did not return coordinates for this address.");
      }
      resolvedAddressRef.current = details.address || description;
      onChange({ ...details, address: details.address || description });
      setStatus("");
    } catch (error) {
      setStatus(error?.message || "Choose an address suggestion so FamOS can find local weather.");
    }
  };

  const select = async (suggestion) => {
    const prediction = suggestion.placePrediction;
    const description = googlePredictionText(prediction);
    setSuggestions([]);
    if (!description) return;
    await resolveAddress(description, prediction?.placeId || prediction?.legacyPrediction?.place_id, prediction);
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
          const text = googlePredictionText(prediction);
          return <button type="button" key={prediction?.placeId || prediction?.legacyPrediction?.place_id || `${text}-${index}`} onMouseDown={(event) => event.preventDefault()} onClick={() => select(suggestion)}><MapPin size={15} /><span>{text}</span></button>;
        })}
      </span>}
      {!googleMapsApiKey && <small className="address-autocomplete-warning">Google Maps is not configured for this deployment.</small>}
      {status && googleMapsApiKey && <small className="address-autocomplete-warning">{status}</small>}
    </label>
  );
}
