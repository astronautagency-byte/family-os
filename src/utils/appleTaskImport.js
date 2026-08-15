export function parseTaskImportText(value = "") {
  return Array.from(new Set(String(value)
    .split(/\r?\n/)
    .map((line) => line
      .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
      .replace(/^\s*\[(?: |x|X)\]\s*/, "")
      .trim())
    .filter((line) => line && !/^(notes?|reminders?|tasks?)\s*:?$/i.test(line))))
    .slice(0, 100);
}

export const parseAppleTaskText = parseTaskImportText;
