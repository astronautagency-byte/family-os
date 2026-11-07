/* Embeddable Add to FamOS control. Attributes are treated as text, never HTML. */
(() => {
  const script = document.currentScript;
  if (!script) return;
  const data = script.dataset;
  const options = [];
  if (data.eventTitle && data.eventStart) options.push(['event', 'Event']);
  if (data.recipeUrl) options.push(['recipe', 'Recipe']);
  if (!options.length) return;
  const wrapper = document.createElement('span');
  wrapper.style.cssText = 'display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;font:600 14px system-ui,sans-serif';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'What to add to FamOS');
  select.style.cssText = 'border:1px solid #c8d4cf;border-radius:10px;padding:10px;background:white;color:#18322a;font:inherit';
  for (const [value, label] of options) { const option=document.createElement('option'); option.value=value; option.textContent=label; select.appendChild(option); }
  const link = document.createElement('a');
  link.textContent = 'Add to FamOS';
  link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.style.cssText = 'display:inline-block;border-radius:10px;padding:11px 16px;background:#bd4b32;color:white;text-decoration:none;font:inherit';
  const update = () => {
    const url = new URL('https://home.fam-os.app/sign-in');
    url.searchParams.set('famos_add', select.value);
    if (select.value === 'event') {
      url.searchParams.set('title', data.eventTitle);
      url.searchParams.set('start', data.eventStart);
      if (data.eventEnd) url.searchParams.set('end', data.eventEnd);
      if (data.eventLocation) url.searchParams.set('location', data.eventLocation);
    } else {
      url.searchParams.set('url', data.recipeUrl);
      if (data.recipeTitle) url.searchParams.set('title', data.recipeTitle);
    }
    link.href = url.href;
  };
  select.addEventListener('change', update); update();
  if (options.length > 1) wrapper.appendChild(select);
  wrapper.appendChild(link); script.insertAdjacentElement('afterend', wrapper);
})();
