import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Modal, SecondaryButton, TextField } from './ui';

export default function AccountDeletion({ compact = false }) {
  const { household, user, deleteAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ownsHome = Boolean(household && (household.created_by
    ? household.created_by === user?.id
    : household.role === 'owner'));
  const consequence = ownsHome
    ? 'This permanently deletes your account and the household you own, including its shared calendars, tasks, meals, shopping lists, chat and uploaded files. Other members keep their own logins.'
    : 'This permanently deletes your account, personal data and uploaded files, and removes your household membership. The shared household and other members’ accounts remain.';
  const close = () => { if (!busy) setOpen(false); };
  const remove = async () => {
    if (busy || confirmation !== 'DELETE') return;
    setBusy(true);
    setError('');
    try { await deleteAccount(); }
    catch (failure) { setError(failure.message || 'Account deletion could not finish. Please try again.'); setBusy(false); }
  };
  return <>
    <div className={compact ? 'mt-4 text-center' : 'rounded-xl border border-[var(--color-border)] p-4'}>
      {!compact && <p className="text-[13px] text-[var(--color-ink-soft)] mb-3">Permanently delete your login and personal data. You can do this here without contacting support.</p>}
      <button type="button" onClick={() => { setConfirmation(''); setError(''); setOpen(true); }} className="text-[var(--color-warn)] font-semibold py-3">Delete account</button>
    </div>
    <Modal open={open} onClose={close} title="Permanently delete your account?">
      <p className="text-[13.5px] text-[var(--color-ink-soft)] leading-relaxed mb-4">{consequence} This cannot be undone.</p>
      <TextField label="Type DELETE to confirm" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" disabled={busy} />
      {error && <p role="alert" className="text-[var(--color-warn)] mb-3">{error}</p>}
      <div className="flex gap-2">
        <SecondaryButton disabled={busy} onClick={close}>Cancel</SecondaryButton>
        <button type="button" disabled={busy || confirmation !== 'DELETE'} onClick={remove} className="w-full rounded-xl bg-[var(--color-warn)] text-white font-semibold text-[14px] py-3 disabled:opacity-40">{busy ? 'Deleting…' : 'Delete account permanently'}</button>
      </div>
    </Modal>
  </>;
}
