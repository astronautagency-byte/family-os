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

// SerpApi's google_events engine only documents these htichips for date
// filtering. "this weekend" / "weekend" / "next weekend" are NOT in the
// documented chip set — passing `date:weekend` makes SerpApi return an
// empty events_results silently. For those, we bake the temporal phrase
// into the q parameter instead so Google can still match it.
//
// Single source of truth: each entry can specify an optional htichips
// (passed to SerpApi) AND/OR an optional tail (inlined into q). The shape
// MUST stay in sync with tests/local-event-query.test.js.
const WHEN_FILTERS: Record<string, { chip?: string; tail?: string }> = {
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

// Country code → human-readable name used by SerpApi's `location` parameter
// for better geocoding. Unknown codes fall back to the ISO code itself so
// the call still goes through.
const COUNTRY_NAMES: Record<string, string> = {
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

// Per-region Google domain so the underlying Google search ranks local results.
const GOOGLE_DOMAIN_FOR_COUNTRY: Record<string, string> = {
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
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
    const category = cleanText(body.category, 40) || "family events";
    const when = cleanText(body.when, 40).toLowerCase();
    const whenFilter = WHEN_FILTERS[when] || {};
    const whenChip = whenFilter.chip || "";
    const whenTail = whenFilter.tail || "";

    // Country drives SerpApi's `gl` param and the query tail. Default to "ca" so
    // existing Canadian households don't change behaviour; non-Canadian clients
    // pass their ISO 3166-1 alpha-2 country code from household_profile.country.
    const rawCountry = cleanText(body.country, 8).toLowerCase();
    const country = /^[a-z]{2}$/.test(rawCountry) ? rawCountry : "ca";

    const rawCities = Array.isArray(body.cities)
      ? body.cities.map((value: unknown) => cleanText(value, 120)).filter((value: string) => value.length >= 2)
      : [];
    const cities = Array.from(new Set(rawCities.length ? rawCities : (location.length >= 2 ? [location] : []))).slice(0, 6);
    if (!cities.length) return json({ error: "Add a home address in Settings to discover events nearby." }, 400);

    const mapEvent = (event: Record<string, unknown>, city: string) => {
      const date = event.date && typeof event.date === "object" ? event.date as Record<string, unknown> : {};
      const venue = event.venue && typeof event.venue === "object" ? event.venue as Record<string, unknown> : {};
      const ticketInfo = Array.isArray(event.ticket_info) ? event.ticket_info : [];
      const firstTicket = ticketInfo[0] && typeof ticketInfo[0] === "object" ? ticketInfo[0] as Record<string, unknown> : {};
      const addressParts = Array.isArray(event.address) ? event.address.map((part) => cleanText(part, 160)).filter(Boolean) : [];
      const title = cleanText(event.title, 180);
      const dateLabel = cleanText(date.start_date, 40) || cleanText(date.when, 60);
      return {
        // SerpApi has no stable id — derive one so we can dedupe across cities.
        id: `${title}|${cleanText(date.start_date, 40)}`.toLowerCase() || crypto.randomUUID(),
        name: title,
        description: cleanText(event.description, 600),
        // SerpApi returns human date strings, not ISO. Keep a friendly label for
        // display; leave startTime empty so the "add to calendar" flow uses sane defaults.
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
        tags: [],
      };
    };

    const fetchCity = async (city: string) => {
      const endpoint = new URL("https://serpapi.com/search.json");
      endpoint.searchParams.set("engine", "google_events");
      // Build q so the temporal phrase is inlined for "this/next weekend"
      // (SerpApi has no documented htichips for them). Strict template so
      // tests can lock the shape down.
      const qParts = [category];
      if (whenTail) qParts.push(whenTail);
      qParts.push("in", city);
      endpoint.searchParams.set("q", qParts.join(" "));
      endpoint.searchParams.set("hl", "en");
      // Country is per-tenant (defaults to "ca" for households without a stored country).
      endpoint.searchParams.set("gl", country);
      const googleDomain = GOOGLE_DOMAIN_FOR_COUNTRY[country];
      if (googleDomain) endpoint.searchParams.set("google_domain", googleDomain);
      // location param is the preferred geocoder input on SerpApi's docs —
      // it works alongside `q` and lifts results out of the wrong country.
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
      return results.map((event: Record<string, unknown>) => mapEvent(event, city));
    };

    // Pure ladder: `mapped` = successful per-city results; `errors` = thrown
    // ones. Status values map cleanly to what the client should render.
    // Mirror kept in tests/local-event-query.test.js.
    const deriveProviderStatus = (mappedCount: number, errorCount: number, total: number, totalEvents: number) => {
      if (errorCount === total) return "upstream_error";
      if (errorCount > 0) return "partial_upstream_error";
      if (totalEvents > 0) return "ok";
      return "empty_results";
    };

    // Run up to 2 cities in parallel — SerpApi's free tier is rate-limited
    // per minute so calling 4+ simultaneously can trip the plan limit. This
    // batching also keeps the surfaced "timing" honest in the UI.
    const mapped: Array<{ city: string; events: ReturnType<typeof mapEvent>[] }> = [];
    const errors: { city: string; message: string }[] = [];
    const batchSize = Math.min(2, cities.length);
    for (let index = 0; index < cities.length; index += batchSize) {
      const batch = cities.slice(index, index + batchSize);
      const settled = await Promise.allSettled(batch.map(fetchCity));
      for (let batchIndex = 0; batchIndex < settled.length; batchIndex += 1) {
        const result = settled[batchIndex];
        const city = batch[batchIndex];
        if (result.status === "fulfilled") {
          mapped.push({ city, events: result.value });
          console.log(JSON.stringify({
            event: "family_local_events_fetch",
            requestId,
            city,
            count: result.value.length,
            htichips: whenChip || null,
            qTail: whenTail || null,
            gl: country,
          }));
        } else {
          const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
          errors.push({ city, message });
          console.warn(JSON.stringify({
            event: "family_local_events_fetch_failed",
            requestId,
            city,
            message,
          }));
        }
      }
    }

    const flatEvents = mapped.flatMap((entry) => entry.events);
    const seen = new Set<string>();
    const events = flatEvents.filter((event: { id: string; name: string }) => {
      if (!event.name) return false;
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    }).slice(0, 24);

    const request = { category, when, whenChip: whenChip || null, whenTail: whenTail || null, country, cities };
    const totalEvents = events.length;
    const providerStatus = deriveProviderStatus(mapped.length, errors.length, cities.length, totalEvents);
    const diagnostics = {
      perCityCounts: mapped.map((entry) => ({ city: entry.city, count: entry.events.length })),
      // Structured so the client can build its own copy, retry filtering,
      // and any diagnostic overlays without parsing prose.
      failedCities: errors.map((entry) => ({ city: entry.city, message: entry.message })),
      succeededCities: mapped.map((entry) => entry.city),
    };

    if (events.length === 0) {
      if (providerStatus === "upstream_error") {
        return json({
          events: [],
          cities,
          provider: "SerpApi (Google Events)",
          country,
          request,
          providerStatus,
          diagnostics,
          error: errors[0]?.message || "Event provider could not be reached.",
        }, 502);
      }
      console.log(JSON.stringify({
        event: "family_local_events_empty",
        requestId,
        providerStatus,
        perCityCounts: diagnostics.perCityCounts,
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
      events,
      cities,
      provider: "SerpApi (Google Events)",
      country,
      request,
      providerStatus,
      diagnostics,
    });
  } catch (error) {
    console.error("search-local-events failed", error);
    return json({ error: error instanceof Error ? error.message : "Could not load local events." }, 500);
  }
});
