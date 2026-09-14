# Reminder delivery: implementation and release gate

## Audit findings

- Existing `send-household-push` delivers immediate activity updates, not scheduled reminders.
- The previous Settings test used local `showNotification`, so it did not test registration, server credentials, or background delivery.
- Device registration errors were swallowed. Settings now exposes them and offers a retry.
- The native Tauri project has no notification plugin/APNs registration. Web Push support must not be presented as native iOS/macOS support.

## Implemented

Settings now queues a server test one minute ahead, addressed only to the requesting user's current registered endpoint. No household message is sent. The worker claims jobs with database locks and a five-minute lease, tracks attempts, retries temporary failures, and removes 404/410 subscriptions. Successful devices are not deliberately retried. A crash between provider acceptance and the database update can still cause a repeat; the stable notification tag helps coalesce it. `accepted` means the push provider accepted the request, not that a person received/read it.

The queue stores absolute UTC instants. It does not yet generate routine occurrences, implement quiet hours, or adjust recurring wall-clock times across DST. Do not connect automatic routine creation until those policies are implemented and tested. Do not enqueue private reminders on shared household displays.

## Activation

1. Apply `202609140003_reminder_delivery_queue.sql` after a dry-run.
2. Verify VAPID public/private keys are configured and the public key matches the app registration key. Never put the private key into frontend environment variables.
3. Set a high-entropy `REMINDER_CRON_SECRET` Edge Function secret. Store that same value in Supabase Vault as `reminder_cron_secret`, and the project URL as `reminder_project_url`.
4. Deploy `send-test-push` with normal JWT verification. Deploy `deliver-reminders` with `--no-verify-jwt`; that worker checks its separate secret header and never accepts a user's JWT as scheduler authority.
5. Enable pg_cron and pg_net, then run the SQL below once. Verify Vault secrets exist first; do not start a silently broken job.

```sql
select cron.schedule('famos-deliver-reminders', '* * * * *', $$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='reminder_project_url') || '/functions/v1/deliver-reminders',
  headers := jsonb_build_object('Content-Type','application/json','x-reminder-secret',
    (select decrypted_secret from vault.decrypted_secrets where name='reminder_cron_secret')),
  body := '{}'::jsonb
 );
$$);
```

Reference: [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions).

## Required verification before claiming reminders work

- Settings → Notifications → Enable → Test background delivery. Close the installed PWA; verify arrival in roughly 1–2 minutes, and that tapping opens Settings.
- Repeat on desktop browser/PWA and Home Screen iPhone PWA; verify denied permission, expired subscription, and registration failure states.
- Use two different accounts: test must reach only the initiating account/device. Check sign-out/account-switch subscription ownership before enabling private routine reminders on shared devices.
- Check queue rows and cron execution logs. `pending` growing means the scheduler is not delivering. `failed` needs investigation; provider acceptance is not a delivery receipt.
- Exercise temporary provider failures, concurrent workers, and worker interruption against a staging database. Physical-device delivery still needs verification.

## Release activation — September 14, 2026

Applied the queue migration, deployed both functions, configured the scheduler secret in Edge Functions and Vault, and enabled pg_cron/pg_net with the `famos-deliver-reminders` minute job. No notification was sent to users during deployment. Provider acceptance and actual device display remain separate checks.

## Remaining product work

Native iOS APNs and macOS notification integration, device unlink on sign-out/shared-display switch, user reminder/quiet-hours preferences, timezone-aware recurrence, task completion/cancellation invalidation, notification-to-specific-item navigation, and a delivery health view. The current test deliberately uses a generic, non-sensitive message and opens Settings.
