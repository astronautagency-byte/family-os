import { GROCERY_ICONS, groceryIllustrationKind } from '../data/groceryIcons';
export { groceryIllustrationKind } from '../data/groceryIcons';

export default function GroceryIllustration({ name, category, icon, size = 36 }) {
  const entry = GROCERY_ICONS[icon] || GROCERY_ICONS[groceryIllustrationKind(name, category)];
  return <span className="grocery-illustration" style={{ width: size, height: size, background: 'transparent' }} aria-hidden="true" data-grocery-icon={entry.id}>
    <svg viewBox={entry.viewBox} width={size} height={size} overflow="hidden" preserveAspectRatio="xMidYMid meet">
      <image href="/illustrations/grocery/flat-grocery-atlas-v1.png" width="1448" height="1086" />
    </svg>
  </span>;
}
