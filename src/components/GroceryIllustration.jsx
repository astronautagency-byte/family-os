import { useId } from 'react';
import { GROCERY_ICONS, groceryIllustrationKind } from '../data/groceryIcons';
export { groceryIllustrationKind } from '../data/groceryIcons';

export default function GroceryIllustration({ name, category, icon, size = 36 }) {
  const clipId = `grocery-crop-${useId().replace(/:/g, '')}`;
  const entry = GROCERY_ICONS[icon] || GROCERY_ICONS[groceryIllustrationKind(name, category)];
  const [x, y, width, height] = entry.viewBox.split(' ').map(Number);
  return <span className="grocery-illustration" style={{ width: size, height: size, background: 'transparent' }} aria-hidden="true" data-grocery-icon={entry.id}>
    <svg viewBox={entry.viewBox} width={size} height={size} overflow="hidden" preserveAspectRatio="xMidYMid meet">
      {/* The square viewport includes letterboxing around non-square cells.
          Clip the atlas to its cell, not just to the outer SVG viewport. */}
      <defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect x={x} y={y} width={width} height={height}/></clipPath></defs>
      <image href="/illustrations/grocery/flat-grocery-atlas-v1.png" width="1448" height="1086" clipPath={`url(#${clipId})`} />
    </svg>
  </span>;
}
