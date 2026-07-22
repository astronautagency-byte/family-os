import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const cleanText = (value: unknown, max = 160) => typeof value === "string" ? value.trim().slice(0, max) : "";

// Nearby major metropolitan areas per country — used for two purposes:
//   1. Auto-expansion when the user's exact town returns 0 events (SerpApi
//      coverage is sparse for places like Newmarket, ON — but Toronto has
//      plenty). When auto-expansion fires, results from nearby cities are
//      marked with origin === "nearby" so the client can label them.
//   2. Surface `availableNearby` to the client on every response so it can
//      render "Try nearby" pills even on the success path (better UX than
//      failing silently).
const NEARBY_CITIES: Record<string, string[]> = {
  ca: ["Toronto", "Mississauga", "Markham", "Vaughan", "Richmond Hill", "Brampton", "Pickering", "Whitby"],
  us: ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego"],
  gb: ["London", "Manchester", "Birmingham", "Leeds", "Bristol", "Liverpool"],
  au: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"],
  mx: ["Mexico City", "Guadalajara", "Monterrey", "Puebla"],
  de: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne"],
  fr: ["Paris", "Lyon", "Marseille", "Toulouse", "Bordeaux"],
  es: ["Madrid", "Barcelona", "Valencia", "Seville"],
  it: ["Rome", "Milan", "Naples", "Turin", "Florence"],
  pt: ["Lisbon", "Porto"],
  nl: ["Amsterdam", "Rotterdam", "The Hague"],
  ie: ["Dublin", "Cork"],
  jp: ["Tokyo", "Osaka", "Kyoto", "Yokohama"],
  sg: ["Singapore"],
  nz: ["Auckland", "Wellington"],
};

// Only trim user-input city names — do NOT title-case. SerpApi's geocoder
// knows that "ON", "OR", "BC" are Canadian province abbreviations; mangling
// "newmarket on" → "Newmarket On" actively hurts the lookup. Pass-through
// preserves province codes, hyphens (Saint-Étienne), and user-known
// variants that the geocoder recognises.
const normalizeCity = (raw: string) => raw.trim().replace(/\s+/g, " ");

// Google's own events index categorises by industry terms (Concerts,
// Festivals, Exhibitions, Sports). Our UI uses friendlier vocabulary
// ("family events", "kids activities") that doesn't always match
// Google's stored categories. Map the dropdown sentences to the closest
// discoverable Google Events term so a default search returns results
// rather than zero-ing because of a category vocabulary mismatch.
const CATEGORY_NORMALISER: Record<string, string> = {
  "family events": "family-friendly activities",
  "kids activities": "kids activities",
  "festivals": "festivals",
  "sports events": "sports events",
  "concerts": "concerts",
  "workshops": "workshops",
  "outdoor activities": "outdoor activities",
  "museums and exhibits": "museums",
};
const normalizeCategory = (raw: string) => {
  const key = raw.toLowerCase().trim();
  return CATEGORY_NORMALISER[key] || raw;
};

// SerpApi Google Events uses htichips for any date filter; embedding
// "this weekend" in q actively zero-results suburban queries because
// Google can't reconcile the natural-language date with its structured
// event index. Map every supported `when` to a real chip value.
// Valid htichips enum per SerpApi: date:today, date:tomorrow, date:week,
// date:weekend, date:next_weekend, date:month, date:next_month.
const WHEN_FILTERS: Record<string, string> = {
  today: "date:today",
  tomorrow: "date:tomorrow",
  "this week": "date:week",
  week: "date:week",
  "this weekend": "date:weekend",
  weekend: "date:weekend",
  "next weekend": "date:next_weekend",
  "this month": "date:month",
  month: "date:month",
  "next month": "date:next_month",
};

const COUNTRY_NAMES: Record<string, string> = {
  ca: "Canada", us: "United States", mx: "Mexico",
  gb: "United Kingdom", uk: "United Kingdom",
  au: "Australia", nz: "New Zealand",
  de: "Germany", fr: "France", es: "Spain", it: "Italy", pt: "Portugal",
  nl: "Netherlands", ie: "Ireland",
  jp: "Japan", kr: "South Korea", sg: "Singapore",
  in: "India", br: "Brazil", za: "South Africa",
};

const GOOGLE_DOMAIN_FOR_COUNTRY: Record<string, string> = {
  ca: "google.ca", us: "google.com", mx: "google.com.mx",
  gb: "google.co.uk", uk: "google.co.uk",
  au: "google.com.au", nz: "google.co.nz",
  de: "google.de", fr: "google.fr", es: "google.es", it: "google.it", pt: "google.pt",
  nl: "google.nl", ie: "google.ie",
  jp: "google.co.jp", sg: "google.com.sg",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const requestId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Sign in to discover local events." }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = Deno.env.get("SERPAPI_KEY");
    if (!url || !serviceKey) return json({ error: "FamOS event discovery is not configured." }, 503);
    if (!apiKey) return json({ error: "Local event discovery needs its SerpApi key configured." }, 503);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) return json({ error: "Your session has expired. Please sign in again." }, 401);

    const body = await request.json().catch(() => ({}));
    const location = cleanText(body.location, 120);
    const categoryRaw = cleanText(body.category, 40) || "family events";
    const category = normalizeCategory(categoryRaw);
    const when = cleanText(body.when, 40).toLowerCase();
    const whenChip = WHEN_FILTERS[when] || "";

    const rawCountry = cleanText(body.country, 8).toLowerCase();
    const country = /^[a-z]{2}$/.test(rawCountry) ? rawCountry : "ca";

    const rawCities = Array.isArray(body.cities)
      ? body.cities.map((value: unknown) => normalizeCity(cleanText(value, 120)))
      : [];
    const cities = Array.from(new Set(rawCities.length ? rawCities : (location.length >= 2 ? [normalizeCity(location)] : []))).slice(0, 6);
    if (!cities.length) return json({ error: "Add a home address in Settings to discover events nearby." }, 400);

    const mapEvent = (event: Record<string, unknown>, city: string, origin: "user" | "nearby") => {
      const date = event.date && typeof event.date === "object" ? event.date as Record<string, unknown> : {};
      const venue = event.venue && typeof event.venue === "object" ? event.venue as Record<string, unknown> : {};
      const ticketInfo = Array.isArray(event.ticket_info) ? event.ticket_info : [];
      const firstTicket = ticketInfo[0] && typeof ticketInfo[0] === "object" ? ticketInfo[0] as Record<string, unknown> : {};
      const addressParts = Array.isArray(event.address) ? event.address.map((part) => cleanText(part, 160)).filter(Boolean) : [];
      const title = cleanText(event.title, 180);
      const dateLabel = cleanText(date.start_date, 40) || cleanText(date.when, 60);
      return {
        id: `${title}|${cleanText(date.start_date, 40)}`.toLowerCase() || crypto.randomUUID(),
        name: title,
        description: cleanText(event.description, 600),
        startTime: "",
        endTime: "",
        dateLabel,
        when: cleanText(date.when, 80),
        virtual: addressParts.some((part) => /online|virtual/i.test(part)),
        thumbnail: cleanText(event.thumbnail, 500) || cleanText(event.image, 500),
        publisher: cleanText(firstTicket.source, 100) || cleanText(venue.name, 100),
        link: cleanText(event.link, 500) || cleanText(firstTicket.link, 500),
        ticketSource: cleanText(firstTicket.source, 80),
        venue: {
          name: cleanText(venue.name, 160) || addressParts[0] || "",
          address: addressParts.join(", "),
          city: cleanText(venue.city, 100) || city,
          rating: typeof venue.rating === "number" ? venue.rating : null,
        },
        origin,
        fromCity: city,
        tags: [],
      };
    };

    const fetchCity = async (city: string, origin: "user" | "nearby") => {
      const endpoint = new URL("https://serpapi.com/search.json");
      endpoint.searchParams.set("engine", "google_events");
      endpoint.searchParams.set("q", category);          // q is just the category; date and city are NOT in q.
      endpoint.searchParams.set("hl", "en");
      endpoint.searchParams.set("gl", country);
      const googleDomain = GOOGLE_DOMAIN_FOR_COUNTRY[country];
      if (googleDomain) endpoint.searchParams.set("google_domain", googleDomain);
      const countryName = COUNTRY_NAMES[country] || country.toUpperCase();
      endpoint.searchParams.set("location", `${city}, ${countryName}`);
      if (whenChip) endpoint.searchParams.set("htichips", whenChip);
      endpoint.searchParams.set("api_key", apiKey);
      const response = await fetch(endpoint);
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.error) {
        throw new Error(String(payload?.error || `Event provider returned HTTP ${response.status}.`));
      }
      const results = Array.isArray(payload?.events_results) ? payload.events_results : [];
      return results.map((event: Record<string, unknown>) => mapEvent(event, city, origin));
    };

    const runBatch = async (batch: Array<{ city: string; origin: "user" | "nearby" }>) => {
      const settled = await Promise.allSettled(batch.map((b) => fetchCity(b.city, b.origin)));
      const mapped: Array<{ city: string; origin: "user" | "nearby"; events: ReturnType<typeof mapEvent>[] }> = [];
      const errors: { city: string; message: string }[] = [];
      for (let batchIndex = 0; batchIndex < settled.length; batchIndex += 1) {
        const result = settled[batchIndex];
        const { city, origin } = batch[batchIndex];
        if (result.status === "fulfilled") {
          mapped.push({ city, origin, events: result.value });
          console.log(JSON.stringify({
            event: "family_local_events_fetch",
            requestId, city, origin,
            count: result.value.length,
            htichips: whenChip || null,
            gl: country,
          }));
        } else {
          const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
          errors.push({ city, message });
          console.warn(JSON.stringify({
            event: "family_local_events_fetch_failed",
            requestId, city, origin, message,
          }));
        }
      }
      return { mapped, errors };
    };

    // ── Phase 1: search the user's exact cities. Rate-limited to 2 in
    //    parallel per batch — keeps us safely under SerpApi's free-tier
    //    per-minute ceiling.
    const userMapped: Array<{ city: string; origin: "user" | "nearby"; events: ReturnType<typeof mapEvent>[] }> = [];
    const userErrors: { city: string; message: string }[] = [];
    const batchSize = Math.min(2, cities.length);
    for (let index = 0; index < cities.length; index += batchSize) {
      const batch = cities.slice(index, index + batchSize).map((city) => ({ city, origin: "user" as const }));
      const { mapped, errors } = await runBatch(batch);
      userMapped.push(...mapped);
      userErrors.push(...errors);
    }

    // ── Phase 2 (conditional): auto-expand to nearby major areas when the
    //    user's own cities returned only a sparse result set. Threshold of
    //    <4 events is intentional — suburban queries on SerpApi typically
    //    return 0–3 real indexed events, while neighbouring metro areas
    //    return dozens. Auto-expansion supplements without overwhelming
    //    results when the user already had good coverage.
    const totalUserEvents = userMapped.reduce((sum, m) => sum + m.events.length, 0);
    const nearbyForCountry = NEARBY_CITIES[country] || [];
    const availableNearby = nearbyForCountry.filter((nearby) => !cities.some((c) => c.toLowerCase() === nearby.toLowerCase())).slice(0, 8);
    const userCleanZeroCount = userMapped.filter((m) => m.events.length === 0).length;
    const nearbyCandidates = (totalUserEvents < 4
      && userCleanZeroCount > 0
      && userErrors.length < cities.length)
      ? availableNearby.slice(0, 3)
      : [];

    const nearbyMapped: Array<{ city: string; origin: "user" | "nearby"; events: ReturnType<typeof mapEvent>[] }> = [];
    const nearbyErrors: { city: string; message: string }[] = [];
    if (nearbyCandidates.length) {
      const nearbyBatchSize = Math.min(2, nearbyCandidates.length);
      for (let index = 0; index < nearbyCandidates.length; index += nearbyBatchSize) {
        const batch = nearbyCandidates.slice(index, index + nearbyBatchSize).map((city) => ({ city, origin: "nearby" as const }));
        const { mapped, errors } = await runBatch(batch);
        nearbyMapped.push(...mapped);
        nearbyErrors.push(...errors);
      }
    }

    const allMapped = [...userMapped, ...nearbyMapped];
    const allErrors = [...userErrors, ...nearbyErrors];

    // First-seen-wins dedupe by event id; user-city entries precede nearby
    // entries so user cities' events win on ties.
    const flatEvents = allMapped.flatMap((entry) => entry.events);
    const seen = new Set<string>();
    const events = flatEvents.filter((event: { id: string; name: string }) => {
      if (!event.name) return false;
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    }).slice(0, 24);

    const request = { category, when, whenChip: whenChip || null, country, cities };
    const totalEvents = events.length;
    const totalCities = cities.length + nearbyCandidates.length;
    const failCount = allErrors.length;
    const deriveProviderStatus = () => {
      if (totalEvents > 0) return failCount > 0 ? "partial_upstream_error" : "ok";
      if (failCount > 0 && failCount < totalCities) return "partial_upstream_error";
      if (failCount === totalCities) return "upstream_error";
      return "empty_results";
    };
    const providerStatus = deriveProviderStatus();
    const diagnostics = {
      perCityCounts: allMapped.map((entry) => ({ city: entry.city, origin: entry.origin, count: entry.events.length })),
      failedCities: allErrors.map((entry) => ({ city: entry.city, message: entry.message })),
      succeededCities: allMapped.map((entry) => entry.city),
      expanded: nearbyCandidates.length > 0,
      expandedCities: nearbyCandidates,
      availableNearby,
    };

    if (events.length === 0) {
      if (providerStatus === "upstream_error") {
        return json({
          events: [],
          cities,
          provider: "SerpApi (Google Events)",
          country, request, providerStatus, diagnostics,
          error: allErrors[0]?.message || "Event provider could not be reached.",
        }, 502);
      }
      console.log(JSON.stringify({
        event: "family_local_events_empty",
        requestId, providerStatus,
        perCityCounts: diagnostics.perCityCounts,
        expanded: diagnostics.expanded,
      }));
      return json({ events: [], cities, provider: "SerpApi (Google Events)", country, request, providerStatus, diagnostics });
    }

    if (providerStatus === "partial_upstream_error") {
      console.log(JSON.stringify({
        event: "family_local_events_partial",
        requestId,
        perCityCounts: diagnostics.perCityCounts,
        failedCities: diagnostics.failedCities.map((entry) => entry.city),
      }));
    }

    return json({
      events, cities,
      provider: "SerpApi (Google Events)",
      country, request, providerStatus, diagnostics,
    });
  } catch (error) {
    console.error("search-local-events failed", error);
    return json({ error: error instanceof Error ? error.message : "Could not load local events." }, 500);
  }
});
