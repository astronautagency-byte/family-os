import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Admin from './Admin';

const state = vi.hoisted(() => ({ admin: true, failOverview: false }));
vi.mock('../lib/supabase', () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: { user: { id: 'admin', email: 'admin@example.com' } } } }), signOut: vi.fn() },
  rpc: async (name) => {
    if (name === 'is_famos_admin') return { data: state.admin, error: null };
    if (name === 'admin_dashboard_overview' && state.failOverview) return { data: null, error: { message: 'Service unavailable' } };
    if (name === 'admin_dashboard_overview') return { data: { households: 4, users: 6 }, error: null };
    if (name === 'admin_analytics_snapshot') return { data: { activeHouseholds30d: 2, series: [] }, error: null };
    if (name === 'admin_support_message_counts') return { data: {}, error: null };
    if (name === 'admin_saas_operations_snapshot') return { data: {}, error: null };
    return { data: [], error: null };
  },
  from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
} }));
beforeEach(() => { state.admin = true; state.failOverview = false; window.history.replaceState({}, '', '/admin'); });
afterEach(cleanup);
it('offers all sections through mobile navigation and opens the audit log', async () => {
  render(<Admin />);
  await screen.findByText('Your operations at a glance');
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  const menu = document.getElementById('admin-mobile-more');
  fireEvent.click(within(menu).getByRole('button', { name: 'Audit log' }));
  expect(screen.getByRole('heading', { name: 'Admin activity' })).toBeInTheDocument();
  expect(document.getElementById('admin-mobile-more')).toBeNull();
});
it('does not display zero metrics when dashboard data fails', async () => {
  state.failOverview = true;
  render(<Admin />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
  expect(screen.getByText('Dashboard metrics are unavailable. Try refreshing.')).toBeInTheDocument();
  expect(screen.queryByText('Total families')).not.toBeInTheDocument();
});
it('does not expose the dashboard to non-admin sessions', async () => {
  state.admin = false;
  render(<Admin />);
  expect(await screen.findByRole('heading', { name: 'Admin access required' })).toBeInTheDocument();
  expect(screen.queryByText('Your operations at a glance')).not.toBeInTheDocument();
});
