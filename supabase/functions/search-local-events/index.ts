import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const cleanText = (value: unknown, max = 160): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

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
const normalizeCity = (raw: string): string => raw.trim().replace(/\s+/g, " ");

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

// ──── Ticketmaster Discovery API ────
// Free read-only tier (5,000 calls/day default, ~5 req/sec). ISO 3166-1
// alpha-2 codes map directly to Ticketmaster's `countryCode` parameter.
// Cities filter against the venue's city field — we send the user's
// exact city names and rely on TM's geocoder for resolution.
const TICKETMASTER_COUNTRY: Record<string, string> = {
  ca: "CA", us: "US", mx: "MX",
  gb: "GB", uk: "GB",
  au: "AU", nz: "NZ",
  de: "DE", fr: "FR", es: "ES", it: "IT", pt: "PT",
  nl: "NL", ie: "IE",
};

// Resolve [startDateTime, endDateTime] ISO 8601 from our `when` enum.
// Ticketmaster's Discovery API uses absolute ISO dates (not natural
// language), so the orchestrator converts the shared enum once and
// SerpApi uses its htichips form separately.
const computeTimeRange = (when: string): { startDateTime: string; endDateTime: string } => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  switch ((when || "").toLowerCase()) {
    case "today":
      end.setDate(end.getDate() + 1);
      break;
    case "tomorrow":
      start.setDate(start.getDate() + 1);
      end.setDate(end.getDate() + 2);
      break;
    case "week":
    case "this week":
      end.setDate(end.getDate() + 7);
      break;
    case "weekend":
    case "this weekend": {
      const dayOfWeek = start.getDay();
      const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
      start.setDate(start.getDate() + daysUntilSat);
      end.setDate(start.getDate() + 2);
      break;
    }
    case "next weekend": {
      const dow = start.getDay();
      const offset = (6 - dow + 7) % 7 || 14;
      start.setDate(start.getDate() + offset);
      end.setDate(start.getDate() + 2);
      break;
    }
    case "month":
    case "this month":
      end.setMonth(end.getMonth() + 1);
      break;
    case "next month":
      start.setMonth(start.getMonth() + 1);
      end.setMonth(end.getMonth() + 2);
      break;
    default:
      end.setDate(end.getDate() + 7);
  }
  return {
    startDateTime: start.toISOString().slice(0, 19) + "Z",
    endDateTime: end.toISOString().slice(0, 19) + "Z",
  };
};

// Shared event shape both providers normalize into. RunProvider uses
// this so it can carry either provider's events under a single type.
type MappedEvent = {
  id: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  dateLabel: string;
  when: string;
  virtual: boolean;
  thumbnail: string;
  publisher: string;
  link: string;
  ticketSource: string;
  venue: { name: string; address: string; city: string; rating: number | null };
  origin: "user" | "nearby";
  fromCity: string;
  tags: Array<{ label: string }>;
  provider: "google_events" | "ticketmaster" | "eventbrite";
};

// ISO 3166-1 alpha-2 → Eventbrite URL country slug.
// Eventbrite uses lowercase full country names for some and ISO codes for
// others. We map the ones we know about and fall back to the ISO code.
const EVENTBRITE_COUNTRY_SLUG: Record<string, string> = {
  ca: "canada", us: "united-states", mx: "mexico", gb: "gb", uk: "gb",
  au: "australia", nz: "new-zealand", de: "germany", fr: "france",
  es: "spain", it: "italy", pt: "portugal", nl: "netherlands", ie: "ireland",
  jp: "japan", sg: "singapore", in: "india", br: "brazil",
};

// ──── Eventbrite web scraper ────
// Eventbrite's official /v3/events/search/ API was shut down in 2019.
// This scraper fetches Eventbrite's public event listing pages and extracts
// structured event data from JSON-LD + HTML microdata embedded in the page.
// The EVENTBRITE_KEY (private token) is sent as a header for authenticated
// access if available, but is not strictly required for public page views.
const slugifyCity = (city: string): string =>
  city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const mapEventbriteEvent = (
  item: Record<string, unknown>,
  city: string,
  origin: "user" | "nearby"
): MappedEvent | null => {
  const name = cleanText(item.name, 180);
  if (!name) return null;

  const startDate = cleanText(item.startDate, 32);
  const endDate = cleanText(item.endDate, 32);
  const url = cleanText(item.url, 500);
  const description = cleanText(item.description, 600);
  const imageUrl = cleanText(item.image, 500);

  // Build a stable id from the event URL (Eventbrite event URLs are unique).
  let safeId = `eb:${name}|${startDate}`.toLowerCase();
  if (url) {
    try { safeId = `eb:${btoa(url).slice(0, 40)}`; } catch { /* keep name+date fallback */ }
  }
  const id = safeId;

  // Venue info from the location field
  const location = asRecord(item.location);
  const venueName = cleanText(location.name, 160);
  const venueAddress = asRecord(location.address);
  const streetAddress = cleanText(venueAddress.streetAddress, 160);
  const addressLocality = cleanText(venueAddress.addressLocality, 100) || city;

  // Parse date into a readable label
  let dateLabel = "";
  if (startDate) {
    const parsed = new Date(startDate);
    if (!Number.isNaN(parsed.getTime())) {
      dateLabel = parsed.toLocaleDateString("en-CA", {
        weekday: "short", month: "short", day: "numeric",
      });
    }
  }

  // Extract image from string or object
  let thumbnail = imageUrl;
  if (!thumbnail && typeof item.image === "object") {
    const imgObj = item.image as Record<string, unknown>;
    thumbnail = cleanText(imgObj.url, 500) || "";
  }

  // Performer/category tags
  const performer = Array.isArray(item.performer) ? item.performer as Array<Record<string, unknown>> : [];
  const tagLabels = performer.map((p) => cleanText(p.name, 60)).filter(Boolean);

  return {
    id,
    name,
    description: description || name,
    startTime: startDate,
    endTime: endDate,
    dateLabel,
    when: dateLabel,
    virtual: /online|virtual/i.test(streetAddress + venueName),
    thumbnail,
    publisher: venueName || "Eventbrite",
    link: url,
    ticketSource: "Eventbrite",
    venue: {
      name: venueName,
      address: streetAddress,
      city: addressLocality,
      rating: null,
    },
    origin,
    fromCity: city,
    tags: tagLabels.map((label) => ({ label })),
    provider: "eventbrite",
  };
};

// Extract schema.org Event items from JSON-LD embedded in the page HTML.
const extractEventbriteJsonLd = (html: string): Record<string, unknown>[] => {
  const events: Record<string, unknown>[] = [];
  // Match all <script type="application/ld+json"> blocks
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && item["@type"] === "Event" && item.name) {
          events.push(item as Record<string, unknown>);
        }
      }
    } catch {
      // Skip invalid JSON blocks
    }
  }
  return events;
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
    const serpApiKey = Deno.env.get("SERPAPI_KEY");
    const ticketmasterKey = Deno.env.get("TICKETMASTER_API_KEY");
    const eventbriteKey = Deno.env.get("EVENTBRITE_API_KEY");
    if (!url || !serviceKey) return json({ error: "FamOS event discovery is not configured." }, 503);
    // All three providers are independently optional. Empty results is fine —
    // the diagnostics will surface which provider ran (or all three) so the
    // user can tell whether the empty list came from a missing key vs
    // a genuine zero-result query.
    if (!serpApiKey && !ticketmasterKey && !eventbriteKey) return json({ error: "Local event discovery needs SerpApi, Ticketmaster, or Eventbrite configured." }, 503);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) return json({ error: "Your session has expired. Please sign in again." }, 401);

    const body = await request.json().catch(() => ({}));
    const location = cleanText(body.location, 120);
    const category = cleanText(body.category, 40) || "family events";
    const when = cleanText(body.when, 40).toLowerCase();
    const whenChip = WHEN_FILTERS[when] || "";

    const rawCountry = cleanText(body.country, 8).toLowerCase();
    const country = /^[a-z]{2}$/.test(rawCountry) ? rawCountry : "ca";

    const rawCities: string[] = Array.isArray(body.cities)
      ? body.cities.map((value: unknown) => normalizeCity(cleanText(value, 120)))
      : [];
    const cities: string[] = Array.from(new Set(rawCities.length ? rawCities : (location.length >= 2 ? [normalizeCity(location)] : []))).slice(0, 6);

    // Client's per-city muted set — user chip clicks that should NOT
    // trigger a SerpApi fetch. Explicit Set<string> annotation so deno's
    // strict mode doesn't widen it to `Set<unknown>` after the chained
    // filter (prior bug: muted values came back as unknown).
    const mutedCities: string[] = (Array.isArray(body.mutedNearbyCities) ? body.mutedNearbyCities : [])
      .map((value: unknown) => normalizeCity(cleanText(value, 120)))
      .filter((s: string): s is string => s.length > 0);
    const mutedSet: Set<string> = new Set(mutedCities);
    const isMuted = (city: string): boolean => {
      const norm = city.toLowerCase();
      for (const muted of mutedSet) if (muted.toLowerCase() === norm) return true;
      return false;
    };
    if (!cities.length) return json({ error: "Add a home address in Settings to discover events nearby." }, 400);

    // Helpers: pull typed values out of arbitrary objects with bounded
    // safety. Many fields come back from SerpApi/TM as `unknown` (because
    // we cast external payloads to Record), so these keep the mappers
    // terse without `any` leakage at the network boundary.
    const asRecord = (value: unknown): Record<string, unknown> =>
      value && typeof value === "object" ? value as Record<string, unknown> : {};
    const recordString = (obj: unknown, key: string, max = 160): string => {
      const value = asRecord(obj)[key];
      return typeof value === "string" ? value.trim().slice(0, max) : "";
    };

    // ──── SerpApi (Google Events) mapper ────
    const mapSerpEvent = (event: Record<string, unknown>, city: string, origin: "user" | "nearby"): MappedEvent => {
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
        provider: "google_events",
      };
    };

    // ──── Ticketmaster Discovery API mapper ────
    // Ticketmaster returns rich structured data: id, name, url, dates,
    // images[], priceRanges[], and _embedded.venues[]. We map into our
    // existing event shape so Calendar.jsx needs no UI changes. Using
    // intermediate `Record<string, unknown>` casts with explicit field
    // extraction (recordString helper) keeps deno's strict checker happy
    // and keeps the response shape resilient to TM API schema drift.
    const mapTicketmasterEvent = (event: unknown, city: string, origin: "user" | "nearby"): MappedEvent => {
      const ev = asRecord(event);
      const datesRoot = asRecord(ev.dates);
      const startObj: Record<string, unknown> = (datesRoot.start && typeof datesRoot.start === "object") ? datesRoot.start as Record<string, unknown> : {};
      const endObj: Record<string, unknown> = (datesRoot.end && typeof datesRoot.end === "object") ? datesRoot.end as Record<string, unknown> : {};

      const imagesRoot = Array.isArray(ev.images) ? ev.images as Array<Record<string, unknown>> : [];
      const image: Record<string, unknown> = imagesRoot[0] || {};

      const venuesRoot = (ev._embedded && typeof ev._embedded === "object" && Array.isArray((ev._embedded as Record<string, unknown>).venues))
        ? (ev._embedded as Record<string, unknown>).venues as Array<Record<string, unknown>>
        : [];
      const venue: Record<string, unknown> = venuesRoot[0] || {};
      const venueAddress: Record<string, unknown> = (venue.address && typeof venue.address === "object") ? venue.address as Record<string, unknown> : {};
      const venueCity: Record<string, unknown> = (venue.city && typeof venue.city === "object") ? venue.city as Record<string, unknown> : {};

      const addressParts = [recordString(venueAddress, "line1", 160), recordString(venueAddress, "line2", 160)].filter(Boolean);
      const startDateTime = recordString(startObj, "dateTime", 32) || recordString(startObj, "localDate", 32);
      const startDateOnly = recordString(startObj, "localDate", 32);
      const startLocalTime = recordString(startObj, "localTime", 16);

      // dateLabel prefers Ticketmaster's structured localDate + localTime
      // which is already in the user's timezone, so we render it cleanly.
      let dateLabel = "";
      if (startDateOnly) {
        const timeOnly = startLocalTime ? startLocalTime.slice(0, 8) : "00:00:00";
        const parsed = new Date(`${startDateOnly}T${timeOnly}`);
        if (!Number.isNaN(parsed.getTime())) {
          dateLabel = parsed.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
        }
      }
      if (!dateLabel && startDateTime) {
        const parsed = new Date(startDateTime);
        if (!Number.isNaN(parsed.getTime())) dateLabel = parsed.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
      }

      const tmId = recordString(ev, "id", 80);
      const tmUrl = recordString(ev, "url", 500);
      const name = cleanText(ev.name, 180);

      // Tags from TM's classification hierarchy: classifications[0].segment.name
      // is the broad category ("Music", "Sports") — useful as a single chip.
      const classifications = Array.isArray(ev.classifications) ? ev.classifications as Array<Record<string, unknown>> : [];
      const firstClassification = classifications[0] || {};
      const segmentObj: Record<string, unknown> = (firstClassification.segment && typeof firstClassification.segment === "object")
        ? firstClassification.segment as Record<string, unknown>
        : {};
      const tagLabel = recordString(segmentObj, "name", 60);

      // Prefix with provider tag so the dedupe set can never collide
      // with a SerpApi event whose id lowercase-matches something
      // Ticketmaster generated (paranoid but cheap).
      const id = tmId
        ? `tm:${tmId}`
        : (name ? `tm:${name}|${startDateOnly}`.toLowerCase() : crypto.randomUUID());

      return {
        id,
        name,
        // Ticketmaster doesn't expose long descriptions; surface the
        // event name as description so the card shows something legible.
        description: name,
        startTime: startDateTime,
        endTime: recordString(endObj, "dateTime", 32),
        dateLabel,
        when: dateLabel,
        virtual: addressParts.some((part) => /online|virtual/i.test(part)),
        thumbnail: recordString(image, "url", 500),
        publisher: recordString(venue, "name", 100) || "Ticketmaster",
        link: tmUrl,
        ticketSource: "Ticketmaster",
        venue: {
          name: recordString(venue, "name", 160),
          address: addressParts.join(", "),
          city: recordString(venueCity, "name", 100) || city,
          rating: null,
        },
        origin,
        fromCity: city,
        tags: tagLabel ? [{ label: tagLabel }] : [],
        provider: "ticketmaster",
      };
    };

    const fetchSerpCity = async (city: string, origin: "user" | "nearby", apiKey: string): Promise<MappedEvent[]> => {
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
      const payload = asRecord(await response.json().catch(() => null));
      if (!response.ok) throw new Error(`Event provider returned HTTP ${response.status}.`);
      const errorText = recordString(payload, "error", 600);
      if (errorText) throw new Error(errorText);
      const results: Array<Record<string, unknown>> = Array.isArray(payload.events_results) ? payload.events_results as Array<Record<string, unknown>> : [];
      return results.map((event) => mapSerpEvent(event, city, origin));
    };

    const fetchTicketmasterCity = async (city: string, origin: "user" | "nearby", apiKey: string): Promise<MappedEvent[]> => {
      const endpoint = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
      endpoint.searchParams.set("apikey", apiKey);
      endpoint.searchParams.set("city", city);
      const tmCountry = TICKETMASTER_COUNTRY[country];
      if (tmCountry) endpoint.searchParams.set("countryCode", tmCountry);
      const { startDateTime, endDateTime } = computeTimeRange(when);
      endpoint.searchParams.set("startDateTime", startDateTime);
      endpoint.searchParams.set("endDateTime", endDateTime);
      endpoint.searchParams.set("size", "20");
      endpoint.searchParams.set("sort", "date,asc");
      const response = await fetch(endpoint);
      const payload = asRecord(await response.json().catch(() => null));
      if (!response.ok) throw new Error(`Ticketmaster returned HTTP ${response.status}.`);
      const errorField = asRecord(payload.error);
      const errorText = recordString(errorField, "message", 600) || recordString(payload, "error", 600);
      if (errorText) throw new Error(errorText);
      const embedded = asRecord(payload._embedded);
      const events: unknown[] = Array.isArray(embedded.events) ? embedded.events as unknown[] : [];
      return events.map((event) => mapTicketmasterEvent(event, city, origin));
    };

    type FetchFn = (city: string, origin: "user" | "nearby") => Promise<MappedEvent[]>;

    const fetchEventbriteCity = async (
      city: string,
      origin: "user" | "nearby",
      apiKey: string
    ): Promise<MappedEvent[]> => {
      const countrySlug = EVENTBRITE_COUNTRY_SLUG[country] || country;
      const citySlug = slugifyCity(city);
      const endpoint = `https://www.eventbrite.com/d/${countrySlug}/${citySlug}/all-events/`;
    
      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      };
      // Send the private token as an Authorization header if available.
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    
      const abortController = new AbortController();
      const abortTimer = setTimeout(() => abortController.abort(), 10_000);
      let response: Response;
      try {
        response = await fetch(endpoint, { headers, signal: abortController.signal });
      } finally {
        clearTimeout(abortTimer);
      }
      if (!response.ok) {
        throw new Error(`Eventbrite returned HTTP ${response.status} for ${city}.`);
      }
      const html = await response.text();
      const jsonldItems = extractEventbriteJsonLd(html);
    
      // Map and filter out nulls
      const events: MappedEvent[] = [];
      for (const item of jsonldItems) {
        const mapped = mapEventbriteEvent(item, city, origin);
        if (mapped) events.push(mapped);
      }
    
      return events.slice(0, 20);
    };

    const runProvider = async (
      citiesForBatch: string[],
      origin: "user" | "nearby",
      fetcher: FetchFn,
      providerLabel: string,
    ): Promise<{ mapped: Array<{ city: string; origin: "user" | "nearby"; events: MappedEvent[] }>; errors: { city: string; message: string; provider: string }[] }> => {
      const mapped: Array<{ city: string; origin: "user" | "nearby"; events: MappedEvent[] }> = [];
      const errors: { city: string; message: string; provider: string }[] = [];
      if (!citiesForBatch.length) return { mapped, errors };
      const batchSize = 2; // respect both providers' per-second quotas at the city-batch granularity
      for (let index = 0; index < citiesForBatch.length; index += batchSize) {
        const batch = citiesForBatch.slice(index, index + batchSize).map((city) => ({ city, origin }));
        const settled = await Promise.allSettled(batch.map((b) => fetcher(b.city, b.origin)));
        for (let batchIndex = 0; batchIndex < settled.length; batchIndex += 1) {
          const result = settled[batchIndex];
          const { city } = batch[batchIndex];
          if (result.status === "fulfilled") {
            mapped.push({ city, origin, events: result.value });
          } else {
            const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
            errors.push({ city, message, provider: providerLabel });
          }
        }
      }
      return { mapped, errors };
    };

    // ── Phase 1: search the user's exact cities. Run all configured
    //    providers in parallel — each hits every user city.
    //    Rate-limited to 2 in-flight per provider per batch.
    const [serpApiPhase1, ticketmasterPhase1, eventbritePhase1] = await Promise.all([
      serpApiKey ? runProvider(cities, "user", (city, origin) => fetchSerpCity(city, origin, serpApiKey), "google_events") : Promise.resolve({ mapped: [], errors: [] }),
      ticketmasterKey ? runProvider(cities, "user", (city, origin) => fetchTicketmasterCity(city, origin, ticketmasterKey), "ticketmaster") : Promise.resolve({ mapped: [], errors: [] }),
      // Eventbrite public search page works without an API key — the key is only
      // used for an optional Authorization header. Always run the provider so events
      // still appear when the key expires or is missing.
      runProvider(cities, "user", (city, origin) => fetchEventbriteCity(city, origin, eventbriteKey || undefined), "eventbrite"),
    ]);
    const userMapped = [...serpApiPhase1.mapped, ...ticketmasterPhase1.mapped, ...eventbritePhase1.mapped];
    const userErrors = [...serpApiPhase1.errors, ...ticketmasterPhase1.errors, ...eventbritePhase1.errors];
    // Cheap telemetry so we can measure the savings: do a single log line
    // when the client sent a muted set, even if it had no impact on this
    // particular request (cities might already be filtered by user list).
    if (mutedSet.size > 0) {
      console.log(JSON.stringify({
        event: "family_local_events_muted_received",
        requestId,
        mutedCities: Array.from(mutedSet),
      }));
    }
    if (ticketmasterKey && userMapped.length === 0) {
      console.log(JSON.stringify({
        event: "family_local_events_tm_coverage_log",
        requestId,
        userMapped: serpApiPhase1.mapped.length,
        tmMapped: ticketmasterPhase1.mapped.length,
      }));
    }

    // ── Phase 2 (conditional): auto-expand to nearby major areas when the
    //    user's own cities returned only a sparse result set. Threshold of
    //    <4 events is intentional — suburban queries on SerpApi typically
    //    return 0–3 real indexed events, while neighbouring metro areas
    //    return dozens. Auto-expansion supplements without overwhelming
    //    results when the user already had good coverage.
    //    Per architecture decision: only SerpApi participates here. The
    //    5 rps Ticketmaster ceiling is too tight to multiply by an
    //    implicit "+ 3 nearby cities" without informing the user.
    const totalUserEvents = userMapped.reduce((sum, m) => sum + m.events.length, 0);
    const nearbyForCountry: string[] = NEARBY_CITIES[country] || [];
    // Two filters applied: (a) the contributing city isn't already in the
    // user's own cities list (no point fetching the same metro twice),
    // (b) the city isn't muted by the user via a chip — skipping
    // seasrches the user has already dismissed saves SerpApi quota and
    // keeps the "Try nearby major area" pill from suggesting cities the
    // user has already rejected.
    const availableNearby: string[] = nearbyForCountry
      .filter((nearby) => !cities.some((c: string) => c.toLowerCase() === nearby.toLowerCase()))
      .filter((nearby) => !isMuted(nearby))
      .slice(0, 8);
    const userCleanZeroCount = userMapped.filter((m) => m.events.length === 0).length;
    // Only count errors from providers that have a valid API key when deciding
    // whether to expand to nearby cities. Eventbrite's best-effort public
    // scraping often fails (HTTP 403/429) — those errors should not block
    // Phase 2 expansion that depends on SerpApi/Ticketmaster succeeding.
    const configuredProviderErrors = userErrors.filter((e) =>
      (e.provider === "google_events" && !!serpApiKey) ||
      (e.provider === "ticketmaster" && !!ticketmasterKey)
    );
    const nearbyCandidates: string[] = serpApiKey && (totalUserEvents < 4
      && userCleanZeroCount > 0
      && configuredProviderErrors.length < cities.length)
      ? availableNearby.slice(0, 3)
      : [];

    const [serpApiPhase2] = await Promise.all([
      nearbyCandidates.length && serpApiKey
        ? runProvider(nearbyCandidates, "nearby", (city, origin) => fetchSerpCity(city, origin, serpApiKey), "google_events")
        : Promise.resolve({ mapped: [], errors: [] }),
    ]);
    const nearbyMapped = serpApiPhase2.mapped;
    const nearbyErrors = serpApiPhase2.errors;

    const allMapped = [...userMapped, ...nearbyMapped];
    const allErrors = [...userErrors, ...nearbyErrors];

    // First-seen-wins dedupe by event id; user-city entries precede nearby
    // entries so user cities' events win on ties. The `tm:` and unprefixed
    // (SerpApi) ids prevent collisions between the two providers.
    const flatEvents = allMapped.flatMap((entry) => entry.events);
    const seen = new Set<string>();
    const events = flatEvents.filter((event: MappedEvent) => {
      if (!event.name) return false;
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    }).slice(0, 24);

    const requestPayload = { category, when, whenChip: whenChip || null, country, cities };
    const totalEvents = events.length;
    const totalCities = cities.length + nearbyCandidates.length;
    const failCount = allErrors.length;
    // Provider status considers the union of both providers' results.
    // A single SerpApi city failing while Ticketmaster succeeds in the
    // same city is `partial_upstream_error`, not a hard failure.
    const deriveProviderStatus = (): string => {
      if (totalEvents > 0) return failCount > 0 ? "partial_upstream_error" : "ok";
      if (failCount > 0 && failCount < totalCities) return "partial_upstream_error";
      if (failCount === totalCities) return "upstream_error";
      return "empty_results";
    };
    const providerStatus = deriveProviderStatus();
    const serpEvents = events.filter((e) => e.provider === "google_events").length;
    const ticketmasterEvents = events.filter((e) => e.provider === "ticketmaster").length;
    const eventbriteEvents = events.filter((e) => e.provider === "eventbrite").length;
    const diagnostics = {
      perCityCounts: allMapped.map((entry) => ({ city: entry.city, origin: entry.origin, count: entry.events.length })),
      failedCities: allErrors.map((entry) => ({ city: entry.city, message: entry.message, provider: entry.provider })),
      succeededCities: allMapped.map((entry) => entry.city),
      expanded: nearbyCandidates.length > 0,
      expandedCities: nearbyCandidates,
      availableNearby,
      providerCounts: { google_events: serpEvents, ticketmaster: ticketmasterEvents, eventbrite: eventbriteEvents },
    };

    const activeProviders = [
      serpApiKey && "SerpApi",
      ticketmasterKey && "Ticketmaster",
      eventbriteKey && "Eventbrite",
    ].filter(Boolean);
    const providerLabel = activeProviders.length ? activeProviders.join(" + ") : "No provider configured";

    if (events.length === 0) {
      if (providerStatus === "upstream_error") {
        return json({
          events: [],
          cities,
          provider: providerLabel,
          country,
          request: requestPayload,
          providerStatus,
          diagnostics,
          error: allErrors[0]?.message || "Event provider could not be reached.",
        }, 502);
      }
      console.log(JSON.stringify({
        event: "family_local_events_empty",
        requestId, providerStatus,
        perCityCounts: diagnostics.perCityCounts,
        expanded: diagnostics.expanded,
        providerCounts: diagnostics.providerCounts,
      }));
      return json({ events: [], cities, provider: providerLabel, country, request: requestPayload, providerStatus, diagnostics });
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
      provider: providerLabel,
      country, request: requestPayload, providerStatus, diagnostics,
    });
  } catch (error) {
    console.error("search-local-events failed", error);
    return json({ error: error instanceof Error ? error.message : "Could not load local events." }, 500);
  }
});
