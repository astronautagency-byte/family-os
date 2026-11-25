// RLS may return success with zero affected rows. UI state may only change
// after the server returns the requested record's id.
export function requireChangedRecord({data, error}, id, message) {
  if (error) throw error;
  if (!data?.some(record => record.id === id)) throw new Error(message);
}
