import { it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { FocusShoppingItem } from '../FocusShoppingItem';

it('keeps the item illustration visible even when a product photo exists', () => {
  const item = { id: 'apple', name: 'Apples', category: 'Produce', photoUrl: '/photo.jpg', quantity: 2 };
  const onToggle = vi.fn();
  const { container, getByRole } = render(<FocusShoppingItem item={item} onToggle={onToggle} onUpdateExpiry={vi.fn()} />);
  expect(container.querySelector('[data-grocery-icon="apple"]')).not.toBeNull();
  expect(container.querySelector('.grocery-illustration').style.width).toBe('48px');
  fireEvent.click(getByRole('button', { name: /Apples/ }));
  expect(onToggle).toHaveBeenCalledWith(item);
});
