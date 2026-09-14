import { it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { IconBox, Card } from '../ui';

it('exposes semantic module tones without replacing icon contents', () => {
  const { container, getByText } = render(<IconBox bg="shopping"><span>Shopping</span></IconBox>);
  expect(container.firstChild.classList.contains('illustrated-icon-box')).toBe(true);
  expect(container.firstChild.dataset.tone).toBe('shopping');
  expect(getByText('Shopping')).toBeDefined();
});
it('preserves shared card variants and caller layout classes', () => {
  const { container } = render(<Card variant="sunken" className="p-4">Content</Card>);
  expect(container.firstChild.classList.contains('kinship-card')).toBe(true);
  expect(container.firstChild.classList.contains('p-4')).toBe(true);
  expect(container.firstChild.className).toContain('surface-sunken');
});
