const DAY_MS = 24 * 60 * 60 * 1000;

// Normalize any supported expiry serialization to a local-noon Date for the
// calendar day it represents. Accepts the Postgres/DateField bare date
// (YYYY-MM-DD) plus full ISO datetimes and timestamps that older app
// versions and legacy local caches left behind. Anything unparseable
// returns null so callers can fall back to "no date" behavior.
export function toLocalDay(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
  }
  const text = String(value);
  // Bare date (Postgres date / DateField) — local calendar day.
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (bare) return new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3]), 12);
  // Full ISO datetimes: the calendar day is the date part of the string
  // itself, regardless of timezone — a "2026-08-25T00:00:00Z" legacy value
  // must stay Aug 25 even where that instant is the 24th locally.
  const iso = /^(\d{4})-(\d{2})-(\d{2})T/.exec(text);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12);
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12);
  return null;
}

// Whole calendar days between expiry and today (negative when already past).
export function daysUntilExpiry(expiresOn, now = new Date()) {
  const expiry = toLocalDay(expiresOn);
  if (!expiry) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.round((expiry.getTime() - today.getTime()) / DAY_MS);
}

export function inventoryExpiryStatus(item, now = new Date(), warningDays = 3) {
  const days = daysUntilExpiry(item?.expiresOn, now);
  if (days === null || Number(item?.quantity || 0) <= 0) return null;
  if (days <= 0) return { state: "expired", days, label: "Passed", urgency: 0 };
  if (days <= warningDays) return { state: "soon", days, label: `Use within ${days} day${days === 1 ? "" : "s"}`, urgency: 2 + days };
  return null;
}

// Shelf-life progress toward expiry: 0% on the day the item was added, 100%
// once the expiry day arrives. Percent measures elapsed time from when the
// item entered the kitchen (or a 7-day window when the add date is unknown),
// so the fill grows as the item ages, matching the "X days left" label
// rendered next to it.
export function inventoryExpiryProgress(item, now = new Date()) {
  const expiry = toLocalDay(item?.expiresOn);
  if (!expiry) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const added = item?.createdAt ? new Date(item.createdAt) : null;
  const validAdded = added && !Number.isNaN(added.getTime()) && added < expiry;
  const start = validAdded
    ? new Date(added.getFullYear(), added.getMonth(), added.getDate(), 12)
    : new Date(expiry.getTime() - 7 * DAY_MS);
  const total = Math.max(DAY_MS, expiry.getTime() - start.getTime());
  const elapsed = Math.max(0, today.getTime() - start.getTime());
  const percent = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  const rawDaysRemaining = Math.round((expiry.getTime() - today.getTime()) / DAY_MS);
  const daysRemaining = rawDaysRemaining <= 0 ? -1 : rawDaysRemaining;
  return { percent, remainingPercent: 100 - percent, daysRemaining };
}

export function expiringInventory(items, now = new Date(), warningDays = 3) {
  return (items || [])
    .map((item) => ({ ...item, expiry: inventoryExpiryStatus(item, now, warningDays) }))
    .filter((item) => item.expiry)
    .sort((left, right) => left.expiry.urgency - right.expiry.urgency || left.name.localeCompare(right.name));
}