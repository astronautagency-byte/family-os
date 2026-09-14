import { forwardRef } from 'react';
import { artwork } from './artwork';
import './icons.css';

const palette = [
  ['#217653','#C9F0DB'], ['#286CAD','#D8EBFB'], ['#9251BE','#ECDFFA'],
  ['#B34E56','#FCE0E5'], ['#926014','#FBE8B6'], ['#267584','#CDEEF1'],
];
const utility = /^(Arrow|Chevron|Plus$|Minus$|X$|Check$|MoreHorizontal|GripVertical|LoaderCircle|Search$|Pause$|Play$|Maximize2|ExternalLink)/;
export function illustratedIcon(name, Original) {
  const Icon = forwardRef(function FamOSIcon({size=24, color, strokeWidth=1.8, className='', style, children, ...props}, ref) {
    const isUtility = utility.test(name);
    const tone = /Alert|Trash|XCircle/.test(name) ? 3 : /Calendar|Cloud|Clock/.test(name) ? 1 : /Shopping|Check|Shield|Leaf/.test(name) ? 0 : /Spark|Settings|Brain/.test(name) ? 2 : /Sun|Trophy|Star|Chef|Coffee|Lightbulb/.test(name) ? 4 : [...name].reduce((sum,c)=>sum+c.charCodeAt(0),0)%palette.length;
    const [ink,paper] = palette[tone];
    const shared = { ...props, ref, width:size, height:size, className:`famos-icon famos-icon--${isUtility?'utility':'illustration'} lucide lucide-${name.replace(/([a-z0-9])([A-Z])/g,'$1-$2').toLowerCase()} ${className}`, 'data-famos-icon':name, 'aria-hidden': props['aria-label'] || props['aria-labelledby'] ? undefined : true, style:{'--icon-ink':ink,'--icon-paper':paper,...style} };
    if (artwork[name]) return <svg {...shared} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">{artwork[name]}{children}</svg>;
    return <Original {...shared} size={size} color={color || (isUtility?'currentColor':ink)} strokeWidth={strokeWidth}>{!isUtility && <circle className="famos-icon-wash" cx="12" cy="12" r="11" fill={paper} stroke="none"/>}{children}</Original>;
  });
  Icon.displayName = `FamOS${name}`;
  return Icon;
}
