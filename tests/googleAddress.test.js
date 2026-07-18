import test from "node:test";
import assert from "node:assert/strict";
import { googleAddressParts, googlePredictionText } from "../src/lib/googleAddress.js";

test("normalizes legacy Google geocoder results used by Safari", () => {
  const result = googleAddressParts({
    formatted_address: "164 McCaffrey Road, Newmarket, ON L3X 1L2, Canada",
    address_components: [
      { long_name: "Newmarket", types: ["locality"] },
      { long_name: "Ontario", short_name: "ON", types: ["administrative_area_level_1"] },
      { long_name: "L3X 1L2", types: ["postal_code"] },
      { long_name: "Canada", short_name: "CA", types: ["country"] },
    ],
    geometry: { location: { lat: () => 44.052, lng: () => -79.459 } },
  });

  assert.deepEqual(result, {
    address: "164 McCaffrey Road, Newmarket, ON L3X 1L2, Canada",
    city: "Newmarket",
    region: "Ontario",
    postalCode: "L3X 1L2",
    country: "Canada",
    latitude: 44.052,
    longitude: -79.459,
  });
});

test("normalizes Places API (New) place fields", () => {
  const result = googleAddressParts({
    formattedAddress: "164 McCaffrey Road, Newmarket, ON L3X 1L2, Canada",
    addressComponents: [
      { longText: "Newmarket", types: ["locality"] },
      { longText: "Ontario", shortText: "ON", types: ["administrative_area_level_1"] },
      { longText: "L3X 1L2", types: ["postal_code"] },
      { longText: "Canada", shortText: "CA", types: ["country"] },
    ],
    location: { lat: 44.052, lng: -79.459 },
  });

  assert.equal(result.city, "Newmarket");
  assert.equal(result.region, "Ontario");
  assert.equal(result.postalCode, "L3X 1L2");
  assert.equal(result.country, "Canada");
  assert.equal(result.latitude, 44.052);
  assert.equal(result.longitude, -79.459);
});

test("renders both new and legacy prediction labels", () => {
  assert.equal(googlePredictionText({ text: { text: "New API address" } }), "New API address");
  assert.equal(googlePredictionText({ legacyPrediction: { description: "Legacy address" } }), "Legacy address");
});
