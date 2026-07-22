import { test } from "node:test";
import assert from "node:assert/strict";

// Mirrors the helpers in supabase/functions/search-local-events/index.ts.
// If you change these maps / country table / status ladder, change BOTH files.

const WHEN_FILTERS = {
  today: { chip: "date:today" },
  tomorrow: { chip: "date:tomorrow" },
  "this week": { chip: "date:week" },
  week: { chip: "date:week" },
  "this month": { chip: "date:month" },
  month: { chip: "date:month" },
  "next month": { chip: "date:next_month" },
  "this weekend": { tail: "this weekend" },
  weekend: { tail: "this weekend" },
  "next weekend": { tail: "next weekend" },
};

const COUNTRY_NAMES = {
  ca: "Canada",
  us: "United States",
  mx: "Mexico",
  gb: "United Kingdom",
  uk: "United Kingdom",
  au: "Australia",
  nz: "New Zealand",
  de: "Germany",
  fr: "France",
  es: "Spain",
  it: "Italy",
  pt: "Portugal",
  nl: "Netherlands",
  ie: "Ireland",
  jp: "Japan",
  kr: "South Korea",
  sg: "Singapore",
  in: "India",
  br: "Brazil",
  za: "South Africa",
};

const GOOGLE_DOMAIN_FOR_COUNTRY = {
  ca: "google.ca",
  us: "google.com",
  mx: "google.com.mx",
  gb: "google.co.uk",
  uk: "google.co.uk",
  au: "google.com.au",
  nz: "google.co.nz",
  de: "google.de",
  fr: "google.fr",
  es: "google.es",
  it: "google.it",
  pt: "google.pt",
  nl: "google.nl",
  ie: "google.ie",
  jp: "google.co.jp",
  sg: "google.com.sg",
};

// Build the SerpApi request payload from the user's intent. Mirrors the
// fetchCity() block in the edge function.
function buildSerpApiRequest({ category, city, country, when }) {
  const filter = WHEN_FILTERS[when] || {};
  const whenChip = filter.chip || "";
  const whenTail = filter.tail || "";
  const qParts = [category];
  if (whenTail) qParts.push(whenTail);
  qParts.push("in", city);
  const countryName = COUNTRY_NAMES[country] || country.toUpperCase();
  const googleDomain = GOOGLE_DOMAIN_FOR_COUNTRY[country] || "";
  const params = {
    engine: "google_events",
    q: qParts.join(" "),
    hl: "en",
    gl: country,
    location: `${city}, ${countryName}`,
  };
  if (googleDomain) params.google_domain = googleDomain;
  if (whenChip) params.htichips = whenChip;
  return params;
}

// Pure ladder mirroring deriveProviderStatus() in the edge function.
// `mapped` is the count of successful per-city fetch results; `errors`
// is the count of thrown ones; `total` is total cities; `totalEvents`
// is the deduped count of event rows that survived. Returns one of
// "ok" | "empty_results" | "partial_upstream_error" | "upstream_error".
function deriveProviderStatus(mappedCount, errorCount, total, totalEvents) {
  if (errorCount === total) return "upstream_error";
  if (errorCount > 0) return "partial_upstream_error";
  if (totalEvents > 0) return "ok";
  return "empty_results";
}

test("today + Toronto resolves to date:today htichips no weekend tail", () => {
  const params = buildSerpApiRequest({ category: "festivals", city: "Toronto", country: "ca", when: "today" });
  assert.equal(params.engine, "google_events");
  assert.equal(params.htichips, "date:today");
  assert.equal(params.q, "festivals in Toronto");
  assert.equal(params.gl, "ca");
  assert.equal(params.google_domain, "google.ca");
  assert.equal(params.location, "Toronto, Canada");
});

test("this weekend in Toronto falls back to inlined tail NO invalid date:weekend htichips", () => {
  const params = buildSerpApiRequest({ category: "festivals", city: "Toronto", country: "ca", when: "this weekend" });
  assert.equal(params.htichips, undefined, "must NOT emit date:weekend");
  assert.equal(params.q, "festivals this weekend in Toronto", "weekend phrase gets baked into q");
});

test("next weekend in Newmarket uses 'next weekend' tail", () => {
  const params = buildSerpApiRequest({ category: "festivals", city: "Newmarket", country: "ca", when: "next weekend" });
  assert.equal(params.htichips, undefined);
  assert.equal(params.q, "festivals next weekend in Newmarket");
  assert.equal(params.location, "Newmarket, Canada");
});

test("this week uses date:week with no tail", () => {
  const params = buildSerpApiRequest({ category: "concerts", city: "Paris", country: "fr", when: "this week" });
  assert.equal(params.htichips, "date:week");
  assert.equal(params.q, "concerts in Paris");
  assert.equal(params.gl, "fr");
  assert.equal(params.google_domain, "google.fr");
  assert.equal(params.location, "Paris, France");
});

test("this month uses date:month htichips", () => {
  const params = buildSerpApiRequest({ category: "outdoor activities", city: "Seattle", country: "us", when: "this month" });
  assert.equal(params.htichips, "date:month");
  assert.equal(params.q, "outdoor activities in Seattle");
  assert.equal(params.google_domain, "google.com");
  assert.equal(params.location, "Seattle, United States");
});

test("next month uses the documented date:next_month", () => {
  const params = buildSerpApiRequest({ category: "workshops", city: "London", country: "gb", when: "next month" });
  assert.equal(params.htichips, "date:next_month");
  assert.equal(params.q, "workshops in London");
  assert.equal(params.google_domain, "google.co.uk");
  assert.equal(params.location, "London, United Kingdom");
});

test("unknown country falls back to upper-case ISO code", () => {
  const params = buildSerpApiRequest({ category: "festivals", city: "Auckland", country: "zz", when: "this weekend" });
  assert.equal(params.google_domain, undefined);
  assert.equal(params.location, "Auckland, ZZ");
  assert.equal(params.q, "festivals this weekend in Auckland");
  assert.equal(params.gl, "zz");
});

test("unknown when chip keeps emissive query minimal", () => {
  const params = buildSerpApiRequest({ category: "family events", city: "Toronto", country: "ca", when: "next quarter" });
  assert.equal(params.htichips, undefined);
  assert.equal(params.q, "family events in Toronto");
});

test("no documented chip value ever equals date:weekend or date:next_weekend", () => {
  for (const [key, value] of Object.entries(WHEN_FILTERS)) {
    assert.notEqual(value.chip, "date:weekend", `${key} must not map to invalid date:weekend`);
    assert.notEqual(value.chip, "date:next_weekend", `${key} must not map to invalid date:next_weekend`);
  }
});

test("weekend-style queries always inline the temporal phrase into q", () => {
  for (const when of ["this weekend", "weekend", "next weekend"]) {
    const params = buildSerpApiRequest({ category: "kids activities", city: "Toronto", country: "ca", when });
    assert.ok(params.q.includes("in Toronto"), `${when} must keep "in Toronto" suffix`);
    assert.ok(params.q.startsWith("kids activities"), `${when} must keep category prefix`);
    assert.ok(
      params.q.includes("weekend"),
      `${when} must produce a q that mentions "weekend" so Google can match`,
    );
  }
});

test("deriveProviderStatus ladder: all succeed with events → ok", () => {
  assert.equal(deriveProviderStatus(3, 0, 3, 12), "ok");
  assert.equal(deriveProviderStatus(1, 0, 1, 5), "ok");
});

test("deriveProviderStatus ladder: all succeed no events → empty_results", () => {
  assert.equal(deriveProviderStatus(3, 0, 3, 0), "empty_results");
});

test("deriveProviderStatus ladder: all cities threw → upstream_error", () => {
  assert.equal(deriveProviderStatus(0, 3, 3, 0), "upstream_error");
  assert.equal(deriveProviderStatus(0, 1, 1, 0), "upstream_error");
});

test("deriveProviderStatus ladder: one city threw but other(s) returned events → partial_upstream_error", () => {
  assert.equal(deriveProviderStatus(2, 1, 3, 7), "partial_upstream_error");
  assert.equal(deriveProviderStatus(1, 1, 2, 4), "partial_upstream_error");
});

test("deriveProviderStatus ladder: one city threw, none returned events → partial_upstream_error (NOT empty_results)", () => {
  // Partial failure is meaningfully different from "no events at all" — the
  // user should see that one area failed upstream vs. Google simply had no
  // matching events.
  assert.equal(deriveProviderStatus(1, 1, 2, 0), "partial_upstream_error");
});
