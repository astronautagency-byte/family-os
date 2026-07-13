function unescapeText(value = "") {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcalDate(value, allDayEnd = false) {
  if (!value) return null;
  if (/^\d{8}$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6)) - 1;
    const day = Number(value.slice(6, 8));
    const date = new Date(year, month, day);
    if (allDayEnd) date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "00", utc] = match;
  const timestamp = utc
    ? Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
    : new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime();
  return new Date(timestamp).toISOString();
}

function propertyValue(block, name) {
  const line = block.find((entry) => entry.toUpperCase().startsWith(`${name}:`) || entry.toUpperCase().startsWith(`${name};`));
  if (!line) return "";
  return line.slice(line.indexOf(":") + 1);
}

export function parseIcalEvents(text, feed) {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];

  return blocks.flatMap((block, index) => {
    const lines = block.split(/\r?\n/);
    const startRaw = propertyValue(lines, "DTSTART");
    const endRaw = propertyValue(lines, "DTEND");
    const start = parseIcalDate(startRaw);
    let end = parseIcalDate(endRaw, /^\d{8}$/.test(endRaw));
    if (!start) return [];
    if (!end) {
      const fallback = new Date(start);
      fallback.setHours(fallback.getHours() + 1);
      end = fallback.toISOString();
    }

    const uid = propertyValue(lines, "UID") || `${start}-${index}`;
    return [{
      id: `ical:${feed.id}:${uid}`,
      externalId: uid,
      title: unescapeText(propertyValue(lines, "SUMMARY")) || "Untitled event",
      start,
      end,
      location: unescapeText(propertyValue(lines, "LOCATION")),
      source: "ical",
      sourceFeedId: feed.id,
      sourceName: feed.name,
      color: feed.color || "#7C5CE5",
      memberIds: [],
    }];
  });
}

export async function fetchIcalFeed(feed) {
  const normalizedUrl = feed.url.trim().replace(/^webcal:\/\//i, "https://");
  const parsedUrl = new URL(normalizedUrl);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Use a published http, https, or webcal calendar link.");

  let response;
  try {
    response = await fetch(parsedUrl.toString(), { headers: { Accept: "text/calendar,text/plain" } });
  } catch {
    throw new Error("This calendar blocked browser syncing. Use its public/published iCal link, or enable cross-origin access for the feed.");
  }
  if (!response.ok) throw new Error(`Calendar feed returned ${response.status}. Check that the published link is still active.`);
  const text = await response.text();
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("That link did not return a valid iCal calendar.");
  return parseIcalEvents(text, { ...feed, url: parsedUrl.toString() });
}
