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

// SerpApi's google_events "date chips" — map the app's friendly `when` to a filter.
const WHEN_CHIPS: Record<string, string> = {
  today: "date:today",
  tomorrow: "date:tomorrow",
  "this week": "date:week",
  week: "date:week",
  "this weekend": "date:weekend",
  weekend: "date:weekend",
  "this month": "date:month",
  month: "date:month",
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
    const whenChip = WHEN_CHIPS[when] || "";

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
      endpoint.searchParams.set("q", `${category} in ${city}, Canada`);
      endpoint.searchParams.set("hl", "en");
      endpoint.searchParams.set("gl", "ca"); // Canada only, for now.
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

    const settled = await Promise.allSettled(cities.map(fetchCity));
    const mapped = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    if (!mapped.length) {
      const firstError = settled.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
      if (firstError) return json({ error: firstError.reason instanceof Error ? firstError.reason.message : "Event provider error." }, 502);
    }

    const seen = new Set<string>();
    const events = mapped.filter((event: { id: string; name: string }) => {
      if (!event.name) return false;
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    }).slice(0, 24);

    return json({ events, cities, provider: "SerpApi (Google Events)", country: "ca" });
  } catch (error) {
    console.error("search-local-events failed", error);
    return json({ error: error instanceof Error ? error.message : "Could not load local events." }, 500);
  }
});
