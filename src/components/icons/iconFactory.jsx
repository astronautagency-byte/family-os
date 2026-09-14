import { forwardRef } from 'react';
import { artwork } from './colourArtwork';
import './icons.css';

const palette = [
  ['#20B4C9','#2DCD99','#FFC43B'], ['#9279F6','#20B4C9','#FF6D5C'],
  ['#2DCD99','#FFC43B','#9279F6'], ['#FF6D5C','#9279F6','#FFC43B'],
  ['#FFC43B','#FF6D5C','#2DCD99'], ['#20B4C9','#9279F6','#2DCD99'],
];
const utility = /^(Arrow|Chevron|Plus$|Minus$|X$|Check$|MoreHorizontal|GripVertical|LoaderCircle|Search$|Pause$|Play$|Maximize2|ExternalLink)/;
export function illustratedIcon(name, Original) {
  const Icon = forwardRef(function FamOSIcon({size=24, color, strokeWidth=2.2, absoluteStrokeWidth=false, className='', style, children, ...props}, ref) {
    const isUtility = utility.test(name);
    const tone = /Alert|Trash|XCircle/.test(name) ? 3 : /Calendar|Cloud|Clock/.test(name) ? 1 : /Shopping|Check|Shield|Leaf/.test(name) ? 0 : /Spark|Settings|Brain/.test(name) ? 2 : /Sun|Trophy|Star|Chef|Coffee|Lightbulb/.test(name) ? 4 : [...name].reduce((sum,c)=>sum+c.charCodeAt(0),0)%palette.length;
    const [ink,secondary,accent] = palette[tone];
    const shared = { ...props, ref, width:size, height:size, className:`famos-icon famos-icon--${isUtility?'utility':'illustration'} ${!isUtility && !artwork[name]?'famos-icon--adapted':''} ${color?'famos-icon--mono':''} lucide lucide-${name.replace(/([a-z0-9])([A-Z])/g,'$1-$2').toLowerCase()} ${className}`, 'data-famos-icon':name, 'aria-hidden': props['aria-hidden'] ?? (props['aria-label'] || props['aria-labelledby'] ? undefined : true), style:{'--icon-cyan':'#20B4C9','--icon-mint':'#2DCD99','--icon-yellow':'#FFC43B','--icon-coral':'#FF6D5C','--icon-purple':'#9279F6','--icon-secondary':secondary,'--icon-accent':accent,color,...style} };
    if (artwork[name]) return <svg {...shared} viewBox="0 0 24 24" fill="none" stroke={color || ink} strokeWidth={absoluteStrokeWidth ? Number(strokeWidth)*24/Number(size) : strokeWidth} xmlns="http://www.w3.org/2000/svg">{artwork[name]}{children}</svg>;
    return <Original {...shared} size={size} color={color || (isUtility?'currentColor':ink)} strokeWidth={strokeWidth} absoluteStrokeWidth={absoluteStrokeWidth}>{children}</Original>;
  });
  Icon.displayName = `FamOS${name}`;
  return Icon;
}
