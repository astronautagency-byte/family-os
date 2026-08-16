# Google Calendar production verification

FamOS requests two Google Calendar scopes so families can select calendars and keep events synchronized in both directions:

- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`

The warning shown by Google cannot be removed in application code. It disappears only after the Google Cloud OAuth consent screen is published to **In production** and Google approves the brand and sensitive scopes. While the project remains in **Testing**, Google also expires refresh tokens after seven days, which is the source of the recurring reconnect prompt.

## Production checklist

1. In Google Cloud Console, select the project that owns the OAuth client configured in Supabase.
2. Open **Google Auth Platform → Branding** and verify:
   - App name: `FamOS`
   - Support email uses a FamOS-controlled address
   - Homepage, privacy policy, and terms URLs are public and use the same verified domain
   - The logo is the current FamOS logo
3. Open **Audience**, select **External**, and publish the app to **In production**.
4. Open **Data access**, retain only the two scopes listed above, then submit them for verification.
5. Add the production domain under **Authorized domains** and verify ownership in Google Search Console.
6. Record the required verification video. Show the complete OAuth flow, explain why calendar selection needs calendar-list read access, and demonstrate creating, updating, deleting, and importing an event.
7. In **Clients**, confirm the authorized redirect URI exactly matches the Supabase callback shown under Authentication → Providers → Google. Do not use the website route as the OAuth callback.
8. In Supabase, make sure the Google provider client ID and secret come from this same production OAuth client. Set the same values as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for the `google-calendar-token` Edge Function.
9. After approval, reconnect once to replace the seven-day Testing refresh token with a production refresh token.

Do not add broader Calendar, Gmail, Contacts, location, or profile scopes. Any additional sensitive scope expands the verification burden and FamOS's privacy exposure.
