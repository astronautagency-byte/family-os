const BRACKETED = /^\[(.+?),\s+(.+?)\]\s+([^:]+):\s?(.*)$/;
const DASHED = /^(.+?),\s+(.+?)\s+-\s+([^:]+):\s?(.*)$/;

function parseDate(datePart, timePart) {
  const direct = new Date(`${datePart} ${timePart}`);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();

  const parts = datePart.split(/[/.]/).map(Number);
  if (parts.length !== 3) return new Date().toISOString();
  let [month, day, year] = parts;
  if (year < 100) year += 2000;
  const time = timePart.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?/i);
  if (!time) return new Date(year, month - 1, day).toISOString();
  let hour = Number(time[1]);
  const minute = Number(time[2]);
  const second = Number(time[3] || 0);
  if (/PM/i.test(time[4] || "") && hour < 12) hour += 12;
  if (/AM/i.test(time[4] || "") && hour === 12) hour = 0;
  return new Date(year, month - 1, day, hour, minute, second).toISOString();
}

export function parseWhatsAppExport(text) {
  const messages = [];
  for (const rawLine of String(text || "").replace(/\r/g, "").split("\n")) {
    const match = rawLine.match(BRACKETED) || rawLine.match(DASHED);
    if (match) {
      const [, datePart, timePart, sender, body] = match;
      if (!body || /security code|messages and calls are end-to-end encrypted/i.test(body)) continue;
      messages.push({ sender: sender.trim(), text: body.trim(), sentAt: parseDate(datePart, timePart) });
    } else if (rawLine.trim() && messages.length) {
      messages[messages.length - 1].text += `\n${rawLine.trim()}`;
    }
  }
  return messages;
}

