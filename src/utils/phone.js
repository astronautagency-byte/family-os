export function phoneDigits(value = "") {
  return String(value).replace(/\D/g, "").slice(0, 15);
}

export function formatPhoneInput(value = "") {
  const raw = String(value);
  const digits = phoneDigits(raw);
  if (!digits) return "";

  const northAmerican = digits.length <= 10 ? digits : digits.startsWith("1") ? digits.slice(1, 11) : null;
  if (northAmerican !== null) {
    const area = northAmerican.slice(0, 3);
    const exchange = northAmerican.slice(3, 6);
    const subscriber = northAmerican.slice(6, 10);
    const prefix = digits.length > 10 || raw.trim().startsWith("+") ? "+1 " : "";
    if (northAmerican.length <= 3) return `${prefix}${area}`;
    if (northAmerican.length <= 6) return `${prefix}(${area}) ${exchange}`;
    return `${prefix}(${area}) ${exchange}-${subscriber}`;
  }

  const groups = digits.match(/.{1,3}/g) || [];
  return `${raw.trim().startsWith("+") ? "+" : ""}${groups.join(" ")}`;
}

export function normalizePhoneE164(value = "") {
  const raw = String(value).trim();
  const digits = phoneDigits(raw);
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return "";
}

export function isValidPhoneNumber(value = "") {
  if (!String(value).trim()) return false;
  return Boolean(normalizePhoneE164(value));
}
