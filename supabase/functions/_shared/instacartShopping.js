/** Build a minimal, explicitly approved grocery handoff without household metadata. */
export function buildInstacartList(items) {
  if (!Array.isArray(items) || !items.length || items.length > 100) throw new Error('Choose between 1 and 100 grocery items.');
  const line_items = items.map((item) => {
    if (!item || typeof item.name !== 'string') throw new Error('Each grocery item needs a name.');
    const name = item.name.replace(/\s+/g, ' ').trim().slice(0, 100);
    if (!name) throw new Error('Each grocery item needs a name.');
    const quantity = Number(item.quantity);
    const unit = String(item.unit || '').trim().toLowerCase();
    const units = new Map([['','each'],['each','each'],['ea','each'],['oz','ounce'],['ounce','ounce'],['lb','pound'],['pound','pound'],['kg','kilogram'],['kilogram','kilogram'],['g','gram'],['gram','gram'],['l','liter'],['liter','liter'],['ml','milliliter'],['milliliter','milliliter']]);
    const line = {name};
    if (Number.isFinite(quantity) && quantity > 0 && quantity <= 1000 && units.has(unit)) line.line_item_measurements = [{quantity, unit: units.get(unit)}];
    return line;
  });
  return {title:'FamOS shopping list',link_type:'shopping_list',expires_in:7,line_items};
}
export function validInstacartLink(value) {
  try {const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'instacart.com' || url.hostname.endsWith('.instacart.com'));} catch {return false;}
}
