const DAY_MS = 24 * 60 * 60 * 1000;

const localDay = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : null;
};

export function inventoryExpiryStatus(item, now = new Date(), warningDays = 3) {
  const expiry = localDay(item?.expiresOn);
  if (!expiry || Number(item?.quantity || 0) <= 0) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const days = Math.round((expiry.getTime() - today.getTime()) / DAY_MS);
  if (days < 0) return { state: "expired", days, label: "Expired", urgency: 0 };
  if (days === 0) return { state: "today", days, label: "Use today", urgency: 1 };
  if (days <= warningDays) return { state: "soon", days, label: `Use within ${days} day${days === 1 ? "" : "s"}`, urgency: 2 + days };
  return null;
}

export function expiringInventory(items, now = new Date(), warningDays = 3) {
  return (items || [])
    .map((item) => ({ ...item, expiry: inventoryExpiryStatus(item, now, warningDays) }))
    .filter((item) => item.expiry)
    .sort((left, right) => left.expiry.urgency - right.expiry.urgency || left.name.localeCompare(right.name));
}
