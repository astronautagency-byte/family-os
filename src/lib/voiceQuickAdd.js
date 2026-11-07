/** Recognize only explicit, low-risk commands. Everything else needs manual entry. */
export function parseVoiceQuickAdd(input) {
  const text=String(input||'').trim().replace(/[.!?]+$/,'').trim();
  let match=text.match(/^(?:please\s+)?add\s+(.+?)\s+to\s+(?:my\s+|the\s+|our\s+)?(?:grocery|groceries|shopping)(?:\s+list)?$/i);
  if(match) return {type:'grocery',name:match[1].trim().slice(0,120)};
  match=text.match(/^(?:please\s+)?(?:add|create)\s+(?:a\s+)?task(?:\s+(?:to|called|named))?\s+(.+)$/i);
  if(match) return {type:'task',name:match[1].trim().slice(0,120)};
  return null;
}
