import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import KitchenWatch from './KitchenWatch';
import { todayISO } from '../lib/dates';

const mocks = vi.hoisted(() => ({ items: [], groceries: [], addGrocery: vi.fn(), features: { groceries: true } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ household: { id: 'home' }, user: { id: 'parent' } }) }));
vi.mock('../context/FamilyContext', () => ({ useFamily: () => ({ groceries: mocks.groceries, addGrocery: mocks.addGrocery, refreshData: vi.fn(), memberById: {} }) }));
vi.mock('../context/HouseholdFeaturesContext', () => ({ useHouseholdFeatures: () => ({ features: mocks.features }) }));
vi.mock('../hooks/useKitchenInventory', () => ({ default: () => ({ items: mocks.items, addItem: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn() }) }));
beforeEach(() => {
  mocks.items = [{ id: 'milk', name: 'Milk', quantity: 1, unit: 'L', category: 'Dairy & Eggs', location: 'fridge', expiresOn: todayISO() }];
  mocks.groceries = [];
  mocks.features.groceries = true;
  mocks.addGrocery.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

it('labels food expiring today accurately and permits replacement', async () => {
  render(<KitchenWatch />);
  expect(screen.getByText('Expires today')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Replace Milk' }));
  await waitFor(() => expect(mocks.addGrocery).toHaveBeenCalledTimes(1));
});
it('shows failed replacement feedback instead of swallowing the error', async () => {
  mocks.addGrocery.mockRejectedValue(new Error('Connection lost'));
  render(<KitchenWatch />);
  fireEvent.click(screen.getByRole('button', { name: 'Replace Milk' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Connection lost'));
});
it('hides shopping actions when the household disables shopping', () => {
  mocks.features.groceries = false;
  render(<KitchenWatch />);
  expect(screen.queryByRole('button', { name: 'Replace Milk' })).toBeNull();
});
it('does not duplicate a replacement already on the shopping list', () => {
  mocks.groceries = [{ id: 'existing', name: 'Milk', done: false }];
  render(<KitchenWatch />);
  const replace = screen.getByRole('button', { name: 'Replace Milk' });
  expect(replace.disabled).toBe(true);
  fireEvent.click(replace);
  expect(mocks.addGrocery).not.toHaveBeenCalled();
});
