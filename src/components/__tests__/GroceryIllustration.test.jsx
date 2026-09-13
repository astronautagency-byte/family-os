import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import GroceryIllustration, { groceryIllustrationKind } from '../GroceryIllustration';

describe('grocery illustrations', () => {
  it('matches whole item names before category fallbacks', () => {
    expect(groceryIllustrationKind('BANANAS', 'Produce')).toBe('banana');
    expect(groceryIllustrationKind('Cheddar cheese', 'Dairy & Eggs')).toBe('cheese');
    expect(groceryIllustrationKind('Eggplant', 'Produce')).toBe('carrot');
  });
  it('handles missing and unknown data', () => {
    expect(groceryIllustrationKind(null, null)).toBe('box');
    expect(groceryIllustrationKind('Rice', 'Pantry')).toBe('jar');
  });
  it('renders decorative, scalable artwork without duplicate accessible text', () => {
    const { container } = render(<GroceryIllustration name="Apple" size={48} />);
    expect(container.firstChild.getAttribute('aria-hidden')).toBe('true');
    expect(container.firstChild.style.width).toBe('48px');
    expect(container.querySelector('svg').getAttribute('viewBox')).toBe('0 0 64 64');
  });
});
