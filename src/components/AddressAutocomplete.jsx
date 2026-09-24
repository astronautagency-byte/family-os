import { useEffect, useRef, useState } from "react";
import { MapPin } from "./icons";
import { fetchGooglePlaceSuggestions, googleMapsApiKey, loadGooglePlaces } from "../lib/googleMapsPlaces";
import { googleAddressParts, googlePredictionText } from "../lib/googleAddress";
import { COUNTRIES, countryCode } from '../lib/countries';

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

export default function AddressAutocomplete({ label = "Home address", value = "", country = '', onChange, placeholder = "Start typing your address" }) {
  const code = countryCode(country);
  const [suggestions, setSuggestions] = useState([]);
  const [maps, setMaps] = useState(null);
  const [status, setStatus] = useState("");
  const requestRef = useRef(0);
  const sessionTokenRef = useRef(null);
  const resolvedAddressRef = useRef("");
  const resolutionRef = useRef(0);
  useEffect(() => { resolvedAddressRef.current=''; setStatus(''); }, [code]);
  useEffect(() => { resolutionRef.current++; return () => {resolutionRef.current++;}; }, [code, value]);

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
    const requestId = ++requestRef.current;
    setSuggestions([]);
    if (!maps || !code || input.length < 3 || input === resolvedAddressRef.current) {
      setSuggestions([]);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      try {
        const results = await fetchGooglePlaceSuggestions({ ...maps, input, country:code, sessionToken: sessionTokenRef.current });
        if (requestId === requestRef.current) setSuggestions(results.slice(0, 6));
      } catch (error) {
        if (requestId === requestRef.current) setStatus(error.message || "Address suggestions are unavailable.");
      }
    }, 180);
    return () => {window.clearTimeout(timer); requestRef.current++;};
  }, [maps, value, code]);

  const resolveAddress = async (description, placeId, prediction) => {
    if (!maps || !code || !description?.trim()) return;
    const resolutionId=++resolutionRef.current;
    try {
      let result;
      if (typeof prediction?.toPlace === "function") {
        const place = prediction.toPlace();
        await place.fetchFields({ fields: ["formattedAddress", "addressComponents", "location"] });
        result = place;
      } else {
        result = await geocodeAddress(maps, placeId ? { placeId } : { address: description.trim(), componentRestrictions:{country:code} });
      }
      const details = googleAddressParts(result);
      if(resolutionId!==resolutionRef.current) return;
      const components=result.address_components || result.addressComponents || [];
      const region=components.find(item=>item.types?.includes('country'));
      if(countryCode(region?.short_name || region?.shortText || details.country)!==code) throw new Error('Choose an address in the selected country.');
      if (!Number.isFinite(details.latitude) || !Number.isFinite(details.longitude)) {
        throw new Error("Google Maps did not return coordinates for this address.");
      }
      resolvedAddressRef.current = details.address || description;
      onChange({ ...details, address: details.address || description });
      setStatus("");
    } catch (error) {
      if(resolutionId!==resolutionRef.current) return;
      setStatus(error?.message || "Choose an address suggestion so FamOS can find local weather.");
    }
  };

  const select = async (suggestion) => {
    requestRef.current++;
    const prediction = suggestion.placePrediction;
    const description = googlePredictionText(prediction);
    setSuggestions([]);
    if (!description) return;
    await resolveAddress(description, prediction?.placeId || prediction?.legacyPrediction?.place_id, prediction);
  };

  const blurTimeoutRef = useRef(null);
  const handleBlur = () => {
    // Use a longer timeout on touch devices so taps on suggestions register
    // before the list disappears.
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const delay = isTouchDevice ? 300 : 150;
    blurTimeoutRef.current = window.setTimeout(() => setSuggestions([]), delay);
    const address = value.trim();
    if (maps && address.length >= 3 && address !== resolvedAddressRef.current) {
      resolveAddress(address);
    }
  };
  const cancelBlur = () => { if (blurTimeoutRef.current) window.clearTimeout(blurTimeoutRef.current); };

  return (
    <div className="address-autocomplete">
      <label className="form-field"><span className="form-label">Country</span><select className="form-control" value={code} onChange={event=>{
        requestRef.current++; resolutionRef.current++; setSuggestions([]);
        onChange({address:'',city:'',region:'',postalCode:'',country:COUNTRIES.find(item=>item.code===event.target.value)?.name||'',latitude:null,longitude:null});
      }}><option value="">Choose your country</option>{COUNTRIES.map(item=><option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
    <label className="form-field">
      <span className="form-label">{label}</span>
      <span className="address-autocomplete-control">
        <MapPin size={17} />
        <input
          className="form-control"
          style={{paddingInlineStart:46}}
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
              country,
              latitude: null,
              longitude: null,
            });
          }}
          onBlur={handleBlur}
        />
      </span>
    </label>
      {suggestions.length > 0 && <span className="address-autocomplete-results" role="listbox">
        {suggestions.map((suggestion, index) => {
          const prediction = suggestion.placePrediction;
          const text = googlePredictionText(prediction);
          return <button type="button" role="option" key={prediction?.placeId || prediction?.legacyPrediction?.place_id || `${text}-${index}`} onMouseDown={(event) => event.preventDefault()} onTouchStart={cancelBlur} onClick={() => select(suggestion)}><MapPin size={15} /><span>{text}</span></button>;
        })}
      </span>}
      {!googleMapsApiKey && <small className="address-autocomplete-warning">Google Maps is not configured for this deployment.</small>}
      {status && googleMapsApiKey && <small className="address-autocomplete-warning">{status}</small>}
      {!code && <small>Choose your country to see relevant address suggestions.</small>}
    </div>
  );
}
