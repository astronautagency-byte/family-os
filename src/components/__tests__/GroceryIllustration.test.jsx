import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import GroceryIllustration, { groceryIllustrationKind } from '../GroceryIllustration';
import { GROCERY_ICONS, GROCERY_CATEGORY_ICONS } from '../../data/groceryIcons';

describe('grocery illustrations', () => {
  it('matches whole item names before category fallbacks', () => {
    expect(groceryIllustrationKind('BANANAS', 'Produce')).toBe('banana');
    expect(groceryIllustrationKind('Cheddar cheese', 'Dairy & Eggs')).toBe('cheese');
    expect(groceryIllustrationKind('Eggplant', 'Produce')).toBe('eggplant');
  });
  it('handles missing and unknown data', () => {
    expect(groceryIllustrationKind(null, null)).toBe('cereal');
    expect(groceryIllustrationKind('Rice', 'Pantry')).toBe('rice');
  });
  it('renders decorative, scalable artwork without duplicate accessible text', () => {
    const { container } = render(<GroceryIllustration name="Apple" size={48} />);
    expect(container.firstChild.getAttribute('aria-hidden')).toBe('true');
    expect(container.firstChild.style.width).toBe('48px');
    expect(container.firstChild.dataset.groceryIcon).toBe('apple');
    expect(container.querySelector('svg').getAttribute('viewBox')).toBe(GROCERY_ICONS.apple.viewBox);
  });
  it('provides 48 unique named icons and valid category fallbacks', () => {
    expect(Object.keys(GROCERY_ICONS)).toHaveLength(48);
    for (const id of Object.values(GROCERY_CATEGORY_ICONS)) expect(GROCERY_ICONS[id]).toBeDefined();
    for (const { viewBox } of Object.values(GROCERY_ICONS)) {
      const [x,y,w,h] = viewBox.split(' ').map(Number);
      expect(x + w).toBeLessThanOrEqual(1448);
      expect(y + h).toBeLessThanOrEqual(1086);
    }
  });
  it('supports explicit icon selection and compound grocery names', () => {
    expect(groceryIllustrationKind('Baby formula')).toBe('baby');
    expect(groceryIllustrationKind('Chicken dog food')).toBe('pet');
    const { container } = render(<GroceryIllustration icon="shrimp" />);
    expect(container.firstChild.dataset.groceryIcon).toBe('shrimp');
  });
});
