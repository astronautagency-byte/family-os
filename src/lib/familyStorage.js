// Legacy calendar state has no trustworthy owner. Never adopt it into a
// signed-in account merely because that account is the next one on a device.
export function familyStorageKey(base, { configured, userId, householdId }) {
  if (!configured) return base;
  if (!userId || !householdId) return null;
  return `${base}:account:${encodeURIComponent(userId)}:${encodeURIComponent(householdId)}`;
}
export function readFamilyStorage(storage, key) {
  if (!key) return null;
  try { const value=storage.getItem(key); return value ? JSON.parse(value) : null; } catch { return null; }
}
export function writeFamilyStorage(storage, key, value) {
  if (!key) return;
  try { storage.setItem(key,JSON.stringify(value)); } catch { /* unavailable or full storage */ }
}
