import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
const state = vi.hoisted(() => ({ auth: {} }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => state.auth }));
import AccountDeletion from './AccountDeletion';

beforeEach(() => {
  cleanup();
  state.auth = { user: { id: 'self' }, household: { created_by: 'self' }, deleteAccount: vi.fn().mockResolvedValue(undefined) };
});
function open() { render(<AccountDeletion />); fireEvent.click(screen.getByRole('button', { name: 'Delete account', exact: true })); }
describe('account deletion', () => {
  it('requires explicit confirmation and permits cancellation without deleting', () => {
    open();
    expect(screen.getByRole('button', { name: 'Delete account permanently' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'delete' } });
    expect(screen.getByRole('button', { name: 'Delete account permanently' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(state.auth.deleteAccount).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('explains household loss to its owner and blocks duplicate requests', async () => {
    state.auth.deleteAccount.mockImplementation(() => new Promise(() => {}));
    open();
    expect(screen.getByText(/household you own/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete account permanently' }));
    expect(state.auth.deleteAccount).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
  it('keeps failed deletion visible and allows a retry', async () => {
    state.auth.household = { created_by: 'other' };
    state.auth.deleteAccount.mockRejectedValueOnce(new Error('Connection interrupted. Try again.'));
    open();
    expect(screen.getByText(/shared household and other members/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete account permanently' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted');
    fireEvent.click(screen.getByRole('button', { name: 'Delete account permanently' }));
    expect(state.auth.deleteAccount).toHaveBeenCalledTimes(2);
  });
  it('is available before a household exists', () => {
    state.auth.household = null;
    render(<AccountDeletion compact />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete account', exact: true }));
    expect(screen.getByRole('dialog', { name: 'Permanently delete your account?' })).toBeInTheDocument();
    expect(screen.queryByText(/household you own/)).not.toBeInTheDocument();
  });
});
