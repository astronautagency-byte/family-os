export function googleAddressParts(result) {
  const components = result?.address_components || result?.addressComponents || [];
  const part = (type) => {
    const component = components.find((item) => item.types?.includes(type));
    return component?.long_name || component?.longText || component?.short_name || component?.shortText || "";
  };
  const location = result?.geometry?.location || result?.location;
  const coordinate = (value) => {
    const resolved = typeof value === "function" ? value() : value;
    return resolved === null || resolved === undefined || resolved === "" ? null : Number(resolved);
  };
  return {
    address: result?.formatted_address || result?.formattedAddress || "",
    city: part("locality") || part("postal_town") || part("administrative_area_level_2"),
    region: part("administrative_area_level_1"),
    postalCode: part("postal_code"),
    country: part("country"),
    latitude: coordinate(typeof location?.lat === "function" ? location.lat.bind(location) : location?.lat),
    longitude: coordinate(typeof location?.lng === "function" ? location.lng.bind(location) : location?.lng),
  };
}

export function googlePredictionText(prediction) {
  return prediction?.text?.text
    || prediction?.text?.toString?.()
    || prediction?.legacyPrediction?.description
    || "";
}
