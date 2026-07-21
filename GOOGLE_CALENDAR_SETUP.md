# Durable Google Calendar + staying signed in

This covers the backend pieces for two fixes that can't be verified from the app
code alone — they need a Supabase deploy and dashboard settings.

---

## 1. Google Calendar keeps disconnecting

**Why it happened:** FamOS connects Google through Supabase OAuth and used the
session's `provider_token` (a Google *access* token). That token expires in ~1
hour and Supabase never refreshes it, so the calendar silently went stale and
looked disconnected. Google returns a long-lived **refresh token**
(`provider_refresh_token`) once, right after consent — we now capture it and mint
fresh access tokens from it server-side.

### What's already wired in the app
- After connecting Google, the client posts `session.provider_refresh_token` to
  the `google-calendar-token` edge function (`action: "store"`) — best-effort,
  a silent no-op until the function is deployed.
- `syncGoogleCalendarNow()` asks the function for a fresh token
  (`action: "token"`) before falling back to the old expiring token.
- Expired tokens now surface a real **Reconnect Google** button (previously it
  re-ran a dead-token sync and stayed stuck).

### Deploy steps
1. **Run the migration** (creates `public.google_oauth_tokens`, RLS-locked to the
   service role):
   ```bash
   supabase db push        # or apply supabase/migrations/202607210001_google_oauth_tokens.sql
   ```
2. **Deploy the function:**
   ```bash
   supabase functions deploy google-calendar-token
   ```
3. **Set the function secrets** (Supabase → Project Settings → Edge Functions →
   Secrets). `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected
   automatically; you only add the Google pair:
   ```bash
   supabase secrets set GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com \
                        GOOGLE_CLIENT_SECRET=xxxxxxxx
   ```

### Google Cloud (one-time)
- Use the **same** OAuth client that Supabase Auth's Google provider uses (APIs &
  Services → Credentials → OAuth 2.0 Client ID).
- Enable the **Google Calendar API** for that project.
- The consent request already sends `access_type=offline` + `prompt=consent`, so
  Google issues a refresh token. If an already-connected user doesn't get one,
  have them disconnect and reconnect once (Google only returns it on fresh
  consent).

### Verify
- Connect Google in Settings, then check `select user_id, updated_at from
  public.google_oauth_tokens;` — a row should appear.
- Wait >1 hour (or revoke the access token) and hit **Sync now** — it should
  refresh transparently instead of showing "Reconnect".

---

## 2. App keeps signing the user out

**App-side (already done):** proactive `supabase.auth.refreshSession()` now runs
for every signed-in session on focus/visibility/interval (previously only in
tablet mode), and `onAuthStateChange` only clears the session on an explicit
`SIGNED_OUT` — a transient failed refresh can no longer log the user out.

**Dashboard settings to confirm** (Supabase → Authentication → Sessions / Tokens):
- **Access token (JWT) expiry:** 3600s is fine now that the client refreshes
  proactively; longer is also OK.
- **Refresh token reuse interval:** keep a non-zero interval (e.g. 10s). If it's
  0 with rotation on, two near-simultaneous refreshes (multiple tabs / a reload
  mid-refresh) can invalidate the session and sign the user out.
- **Time-box / inactivity timeout:** leave disabled unless you specifically want
  forced re-login, since the goal is "come back anytime without logging in."

---

## Rollback
- Frontend changes degrade gracefully: if the function/migration aren't deployed,
  `getFreshGoogleToken()` returns null and the app uses the previous behavior.
- To remove the backend: `supabase functions delete google-calendar-token` and
  drop the `google_oauth_tokens` table.
