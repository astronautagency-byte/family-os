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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Sign in to discover local events." }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = Deno.env.get("OPENWEBNINJA_API_KEY");
    if (!url || !serviceKey) return json({ error: "FamOS event discovery is not configured." }, 503);
    if (!apiKey) return json({ error: "Local event discovery needs its OpenWeb Ninja API key configured." }, 503);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) return json({ error: "Your session has expired. Please sign in again." }, 401);

    const body = await request.json().catch(() => ({}));
    const location = cleanText(body.location, 120);
    const category = cleanText(body.category, 40) || "family events";
    const when = cleanText(body.when, 40) || "this weekend";
    // Accept a list of cities to widen the search radius. Falls back to the
    // single `location` string for backwards compatibility with older clients.
    const rawCities = Array.isArray(body.cities)
      ? body.cities.map((value: unknown) => cleanText(value, 120)).filter((value: string) => value.length >= 2)
      : [];
    const cities = Array.from(new Set(rawCities.length ? rawCities : (location.length >= 2 ? [location] : []))).slice(0, 6);
    if (!cities.length) return json({ error: "Add a home address in Settings to discover events nearby." }, 400);

    const mapEvent = (event: Record<string, unknown>) => {
      const venue = event.venue && typeof event.venue === "object" ? event.venue as Record<string, unknown> : {};
      const ticketLinks = Array.isArray(event.ticket_links) ? event.ticket_links : [];
      const infoLinks = Array.isArray(event.info_links) ? event.info_links : [];
      const firstTicket = ticketLinks[0] && typeof ticketLinks[0] === "object" ? ticketLinks[0] as Record<string, unknown> : {};
      const firstInfo = infoLinks[0] && typeof infoLinks[0] === "object" ? infoLinks[0] as Record<string, unknown> : {};
      return {
        id: cleanText(event.event_id, 240) || crypto.randomUUID(),
        name: cleanText(event.name, 180),
        description: cleanText(event.description, 600),
        startTime: cleanText(event.start_time, 40),
        endTime: cleanText(event.end_time, 40),
        virtual: Boolean(event.is_virtual),
        thumbnail: cleanText(event.thumbnail, 500),
        publisher: cleanText(event.publisher, 100),
        link: cleanText(firstTicket.link, 500) || cleanText(event.link, 500) || cleanText(firstInfo.link, 500),
        ticketSource: cleanText(firstTicket.source, 80),
        venue: {
          name: cleanText(venue.name, 160),
          address: cleanText(venue.full_address, 240),
          city: cleanText(venue.city, 100),
          rating: typeof venue.rating === "number" ? venue.rating : null,
        },
        tags: Array.isArray(event.tags) ? event.tags.filter((tag: unknown) => typeof tag === "string").slice(0, 5) : [],
      };
    };

    const fetchCity = async (city: string) => {
      const endpoint = new URL("https://api.openwebninja.com/realtime-events-data/search-events");
      endpoint.searchParams.set("query", `${category} in ${city} ${when}`);
      const response = await fetch(endpoint, { headers: { "x-api-key": apiKey } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.message || payload?.error || `Event provider returned HTTP ${response.status}.`;
        throw new Error(String(message));
      }
      return Array.isArray(payload) ? payload
        : Array.isArray(payload?.data) ? payload.data
        : Array.isArray(payload?.events) ? payload.events
        : Array.isArray(payload?.data?.events) ? payload.data.events
        : [];
    };

    const settled = await Promise.allSettled(cities.map(fetchCity));
    const rawEvents = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    if (!rawEvents.length) {
      const firstError = settled.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
      if (firstError) return json({ error: firstError.reason instanceof Error ? firstError.reason.message : "Event provider error." }, 502);
    }

    // Merge results across cities and drop duplicates by event id (or name+time).
    const seen = new Set<string>();
    const events = rawEvents.map(mapEvent).filter((event: { id: string; name: string; startTime: string }) => {
      if (!event.name) return false;
      const key = event.id || `${event.name}|${event.startTime}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 24);

    return json({ events, cities, provider: "OpenWeb Ninja" });
  } catch (error) {
    console.error("search-local-events failed", error);
    return json({ error: error instanceof Error ? error.message : "Could not load local events." }, 500);
  }
});
