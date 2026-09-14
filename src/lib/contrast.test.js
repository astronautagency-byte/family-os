import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {APP_COLOR_SCHEMES} from '../data/appColorSchemes';
const css=readFileSync('src/theme/contrast.css','utf8');
const luminance=hex=>{const rgb=hex.match(/[a-f\d]{2}/gi).map(value=>parseInt(value,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
it('checks every restored scheme accent in both modes',()=>{
 const schemes=readFileSync('src/theme/scheme-accents.css','utf8');
 const rules=[...schemes.matchAll(/([^{}]+)\{([^{}]+)\}/g)];
 expect(rules).toHaveLength(APP_COLOR_SCHEMES.length*2);
 for(const [,selector,body] of rules){
  const dark=selector.includes('theme-dark');
  const accent=body.match(/--color-accent:(#[\da-f]{6})/i)[1];
  expect(ratio(accent,dark?'#22372E':'#EDF1EF')).toBeGreaterThanOrEqual(4.5);
  expect(ratio(accent,dark?'#10271B':'#FFFFFF')).toBeGreaterThanOrEqual(4.5);
 }
});
it('keeps shared text and action labels above 4.5:1 in both themes',()=>{
 const themes=[...css.matchAll(/\{([^{}]*--color-canvas:[^{}]*)\}/g)].map(match=>Object.fromEntries([...match[1].matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map(m=>[m[1],m[2]])));
 expect(themes).toHaveLength(2);
 for(const theme of themes){
  for(const ink of ['color-ink','color-ink-soft','color-ink-faint','color-accent-strong','color-danger','color-warn'])for(const surface of ['color-surface','color-surface-sunken','color-canvas'])expect(ratio(theme[ink],theme[surface]),`${ink} on ${surface}`).toBeGreaterThanOrEqual(4.5);
  expect(ratio(theme['color-on-accent'],theme['color-accent'])).toBeGreaterThanOrEqual(4.5);
 }
});
