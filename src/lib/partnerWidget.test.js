import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
const scriptSource = readFileSync('public/partner/add-to-famos.js', 'utf8');
afterEach(() => { document.body.innerHTML=''; delete document.currentScript; });
it('offers both event and recipe links without inserting supplied HTML', () => {
 const script=document.createElement('script'); script.dataset.eventTitle='<img src=x onerror=alert(1)>'; script.dataset.eventStart='2027-04-10'; script.dataset.recipeUrl='https://example.com/recipe'; document.body.appendChild(script);
 Object.defineProperty(document,'currentScript',{configurable:true,value:script});
 new Function(scriptSource)();
 const container=script.nextElementSibling, link=container.querySelector('a'), select=container.querySelector('select');
 expect(container.querySelector('img')).toBeNull();
 expect(new URL(link.href).searchParams.get('famos_add')).toBe('event');
 select.value='recipe'; select.dispatchEvent(new Event('change'));
 expect(new URL(link.href).searchParams.get('url')).toBe('https://example.com/recipe');
 expect(link.rel).toContain('noopener');
});
