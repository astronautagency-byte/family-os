import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import FamilyLocation from './FamilyLocation';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'alex' }, household: { id: 'home' } }) }));
vi.mock('../context/FamilyContext', () => ({ useFamily: () => ({ memberById: { alex: { id: 'alex', name: 'Alex' } } }) }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('does not request location until the member chooses to share and can stop', async () => {
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  const geo = { watchPosition: vi.fn(), clearWatch: vi.fn() };
  geo.watchPosition.mockImplementation(success => { queueMicrotask(() => success({ coords: { latitude: 43, longitude: -80, accuracy: 25 } })); return 7; });
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geo });
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  render(<FamilyLocation />);
  expect(geo.watchPosition).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Share my location' }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('share_family_location', { h: 'home', lat: 43, lon: -80, accuracy: 25 }));
  fireEvent.click(await screen.findByRole('button', { name: 'Stop sharing' }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('stop_family_location', { h: 'home' }));
  expect(geo.clearWatch).toHaveBeenCalledWith(7);
});

it('saves a check-in without asking for location', async () => {
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  const geo = { watchPosition: vi.fn(), clearWatch: vi.fn() };
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geo });
  render(<FamilyLocation />);
  fireEvent.click(screen.getByRole('button', { name: 'I’m okay' }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('send_family_checkin', { h: 'home' }));
  expect(geo.watchPosition).not.toHaveBeenCalled();
});

it('keeps the member avatar separate from the flexible location details', async () => {
  mocks.rpc.mockImplementation(async name => ({
    data: name === 'get_family_locations' ? [{ user_id: 'alex', latitude: 43, longitude: -80, accuracy_m: 25, updated_at: '2026-11-07T12:00:00Z' }] : [], error: null,
  }));
  render(<FamilyLocation />);
  const mapLink = await screen.findByRole('link', { name: 'Open Alex location in Google Maps' });
  const row = mapLink.closest('article');
  expect(row.querySelector('.family-avatar')).not.toHaveClass('family-location-member-details');
  expect(row.querySelector('.family-location-member-details')).toHaveTextContent('Alex');
});
