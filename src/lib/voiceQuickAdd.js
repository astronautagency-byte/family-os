/** Recognize a bounded set of household actions; never infer destructive actions. */
export function parseVoiceQuickAdd(input) {
  const text = String(input || '').trim().replace(/[.!?]+$/, '').trim()
    .replace(/^(?:(?:hey\s+famos|famos)[,\s]+)?(?:(?:can|could|would) you\s+|(?:i'd|i would) like you to\s+)?(?:please\s+)?/i, '')
    .replace(/\s+please$/i, '').trim();
  let match = text.match(/^(?:add|put)\s+(.+?)\s+(?:to|on)\s+(?:my\s+|the\s+|our\s+)?(?:grocery|groceries|shopping)(?:\s+list)?$/i);
  if (match) return { type: 'grocery', name: match[1].trim().slice(0, 120) };
  match = text.match(/^(?:add|create|make)\s+(?:a\s+)?task(?:\s+(?:to|called|named))?\s+(.+)$/i);
  if (match) return { type: 'task', name: match[1].trim().slice(0, 120) };
  return null;
}
export function parseVoiceConfirmation(input) {
  const text = String(input || '').trim().toLowerCase().replace(/[.!?,]+/g, '').trim();
  if (/^(yes|yeah|yep|confirm|yes please|go ahead|do it)$/.test(text)) return 'yes';
  if (/^(no|nope|cancel|not now|don't|do not)$/.test(text)) return 'no';
  return null;
}
