import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductUpdateBanner, { LOCATION_UPDATE_ID } from './ProductUpdateBanner';

const mocks = vi.hoisted(() => ({ user: { id: 'member-1' }, reads: [], upsert: vi.fn(), eq: vi.fn(), neq: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('../lib/supabase', () => ({ supabase: { from: (table) => {
  if (table === 'product_update_reads') return {
    select: () => ({ eq: async () => ({ data: mocks.reads, error: null }) }),
    upsert: mocks.upsert,
  };
  const query = {
    select: () => query, eq: (...args) => { mocks.eq(...args); return query; },
    neq: (...args) => { mocks.neq(...args); return query; }, not: () => query,
    order: () => query, limit: async () => ({ data: [{ id: LOCATION_UPDATE_ID, title: 'A little closer, wherever you are', summary: 'Share your location while this page is open.', category: 'feature', icon: 'location', link_label: 'Explore family location' }] }),
  };
  return query;
} } }));
afterEach(() => { cleanup(); mocks.reads = []; vi.clearAllMocks(); });

it('opens location and records dismissal for the current member', async () => {
  mocks.upsert.mockResolvedValue({ error: null });
  const navigate = vi.fn();
  render(<ProductUpdateBanner locationOnly onNavigate={navigate} />);
  fireEvent.click(await screen.findByRole('button', { name: /Explore family location/i }));
  expect(navigate).toHaveBeenCalledWith('location');
  expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ update_id: LOCATION_UPDATE_ID, user_id: 'member-1', dismissed: true }), expect.any(Object));
  expect(mocks.eq).toHaveBeenCalledWith('id', LOCATION_UPDATE_ID);
});

it('does not show an update already dismissed by the member', async () => {
  mocks.reads = [{ update_id: LOCATION_UPDATE_ID, dismissed: true }];
  render(<ProductUpdateBanner locationOnly onNavigate={vi.fn()} />);
  await waitFor(() => expect(mocks.eq).toHaveBeenCalledWith('id', LOCATION_UPDATE_ID));
  expect(screen.queryByText('A little closer, wherever you are')).not.toBeInTheDocument();
});
