import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://api.weatherapi.com/v1/forecast.json";

// Normalise WeatherAPI condition codes into a small set of "kinds" the app renders
// with its own lucide icons — so we never depend on WeatherAPI's icon CDN.
const CODE_KINDS: Record<string, number[]> = {
  clear: [1000],
  "partly-cloudy": [1003],
  cloudy: [1006, 1009],
  fog: [1030, 1135, 1147],
  drizzle: [1063, 1150, 1153, 1168, 1171, 1180, 1183, 1240],
  rain: [1186, 1189, 1192, 1195, 1198, 1201, 1243, 1246],
  snow: [1066, 1069, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264],
  thunder: [1087, 1273, 1276, 1279, 1282],
};
const CODE_TO_KIND = new Map<number, string>();
for (const [kind, codes] of Object.entries(CODE_KINDS)) {
  for (const code of codes) CODE_TO_KIND.set(code, kind);
}
const kindFor = (code: number) => CODE_TO_KIND.get(Number(code)) || "cloudy";

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const apiKey = Deno.env.get("WEATHERAPI_KEY");
    if (!apiKey) throw new Error("Weather is not configured yet.");

    const { latitude, longitude, days = 3 } = await request.json();
    const lat = num(latitude);
    const lon = num(longitude);
    if (lat === null || lon === null) throw new Error("A valid location is required.");

    const url = new URL(API_BASE);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("q", `${lat},${lon}`);
    url.searchParams.set("days", String(Math.min(Math.max(Number(days) || 3, 1), 3)));
    url.searchParams.set("aqi", "no");
    url.searchParams.set("alerts", "yes");

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather lookup failed with status ${response.status}`);
    const data = await response.json();

    const current = data?.current || {};
    const forecastDays: any[] = data?.forecast?.forecastday || [];

    // Rain chance "now" = the current hour's chance, so weather-risk logic stays meaningful.
    const nowEpoch = Number(current.last_updated_epoch) || Math.floor(Date.now() / 1000);
    const allHours = forecastDays.flatMap((day) => day.hour || []);
    const currentHour = allHours.find((hour: any) => Number(hour.time_epoch) >= nowEpoch - 1800 && Number(hour.time_epoch) <= nowEpoch + 1800);
    const currentRainChance = num(currentHour?.chance_of_rain) ?? num(forecastDays[0]?.day?.daily_chance_of_rain) ?? 0;

    const daily = forecastDays.map((day) => ({
      date: day.date,
      maxC: num(day.day?.maxtemp_c),
      minC: num(day.day?.mintemp_c),
      rainChance: num(day.day?.daily_chance_of_rain) || 0,
      kind: kindFor(day.day?.condition?.code),
      conditionText: day.day?.condition?.text || "",
      sunrise: day.astro?.sunrise || "",
      sunset: day.astro?.sunset || "",
    }));

    const alerts = (data?.alerts?.alert || [])
      .filter((alert: any) => alert?.event || alert?.headline)
      .slice(0, 3)
      .map((alert: any) => ({
        event: alert.event || alert.headline || "Weather alert",
        headline: alert.headline || "",
        severity: alert.severity || "",
        expires: alert.expires || "",
      }));

    const payload = {
      source: "weatherapi",
      location: { name: data?.location?.name || "", region: data?.location?.region || "" },
      current: {
        tempC: num(current.temp_c),
        feelsLikeC: num(current.feelslike_c),
        kind: kindFor(current.condition?.code),
        conditionText: current.condition?.text || "",
        isDay: current.is_day === 1,
        windKph: num(current.wind_kph) || 0,
        humidity: num(current.humidity) || 0,
        uv: num(current.uv) || 0,
        rainChance: currentRainChance,
      },
      daily,
      alerts,
    };

    return new Response(JSON.stringify(payload), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("weather failed", error);
    return new Response(JSON.stringify({ error: "Weather is temporarily unavailable." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
