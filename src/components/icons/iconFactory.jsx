import { forwardRef } from 'react';
import './icons.css';

// UI symbols use one readable stroke colour. Food illustrations and member /
// calendar identity colours are separate content, not navigation decoration.
export function illustratedIcon(name, Original) {
  const Icon = forwardRef(function FamOSIcon({size=24,color='currentColor',strokeWidth=2.2,className='',style,children,...props},ref) {
    return <Original {...props} ref={ref} size={size} color={color} strokeWidth={strokeWidth}
      className={`famos-icon ${className}`} data-famos-icon={name}
      aria-hidden={props['aria-hidden'] ?? (props['aria-label'] || props['aria-labelledby'] ? undefined : true)}
      style={style}>{children}</Original>;
  });
  Icon.displayName=`FamOS${name}`;
  return Icon;
}
