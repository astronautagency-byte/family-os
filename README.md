# Family OS

A private, mobile-first Progressive Web App for running your family's day-to-day — Today, Calendar, Meals, Groceries, Tasks, and Settings, in one calm, Notion-inspired home base.

Family OS uses **Supabase** for passwordless authentication, private household data, and realtime sync. If Supabase environment variables are omitted, it falls back to local demo data stored in `localStorage`.

## Tech stack

- React 19 + Vite 8
- Tailwind CSS v4
- `vite-plugin-pwa` for the manifest + service worker (installable, works offline)
- `lucide-react` for icons

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL. For the truest mobile feel, open your browser's device toolbar and pick an iPhone size, or open the dev server URL directly on your phone (same Wi-Fi network — use the "Network" URL Vite prints).

## Building for production

```bash
npm run build
npm run preview   # serve the production build locally to test
```

The production build (in `dist/`) includes the web app manifest and service worker needed for "Add to Home Screen" support.

Production domain: `https://fam-os.app/`.

## Installing on an iPhone (PWA)

1. Deploy the contents of `dist/` to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages — all work with zero config for a Vite app), or run it on your home network.
2. Open the URL in **Safari** on the iPhone (must be Safari, not Chrome, for the install prompt to appear).
3. Tap the **Share** icon → **Add to Home Screen**.
4. Family OS now opens full-screen from the home screen, with its own icon, no browser chrome.

## Project structure

```
src/
  data/mockData.js          Seed data: family members, events, meals, groceries, tasks
  context/FamilyContext.jsx Global state + localStorage persistence (swap this for a real API later)
  lib/dates.js               Date/time formatting helpers
  components/ui.jsx          Shared primitives: Card, Avatar, Checkbox, Modal, Tag, buttons...
  components/BottomNav.jsx   Bottom tab bar
  components/PageHeader.jsx  Shared page header
  pages/
    Today.jsx       Agenda, dinner plan, today's tasks, grocery reminder
    Calendar.jsx    Week strip + color-coded agenda, filterable by family member
    Meals.jsx       7-day meal planner (breakfast/lunch/dinner), tap a slot to edit
    Groceries.jsx   Categorized list with checkboxes and an add-item sheet
    Tasks.jsx       Chores/to-dos with assignee, due date, and completion
    Settings.jsx    Manage family members, names, roles, and colors
```

## Onboarding gate

The post-login experience for a household *owner* is gated by `refreshAccount()` in `src/context/AuthContext.jsx`. The owner is treated as "set up" — and skips the wizard — when **any** of the following holds:

1. The `household_profiles.completed_at` column is non-null for their household.
2. The localStorage key `family-os:onboarding-profile-complete:<householdId>:<userId>` is exactly `"true"` in the browser.
3. The owner clicked the "Skip the rest — my home is ready" button (wired to `markOnboardingComplete()` in `AuthContext`). That helper sets the local flag synchronously and best-effort writes `completed_at` server-side.
4. Activity inference: any of `tasks`, `messages`, `events`, `meals`, or `grocery_items` has at least one row for the household. Confirms the family is operational even when their `household_profiles` row is missing or stale.

Conceptually the gate is:

```js
const profileComplete =
  Boolean(householdProfileData?.completed_at)
  || localStorage.getItem(onboardingKey) === "true"
  || activityInferredComplete; // any of 5 tables has rows
```

Companion changes (apply in this order if you are reproducing from scratch):

- `supabase/migrations/202607210006_backfill_onboarding_completed.sql` — idempotent; backfills `completed_at` on any row originally inserted without it.
- Git: `27c8667` (Layer 1 backfill), `d6391e2` (Layer 2 activity inference), `5407ad6` (Layer 3 escape hatch + `markOnboardingComplete`).

### Policy for contributors

- **Do not tighten the gate back to "only `completed_at IS NOT NULL`"**. Several existing households predate the `household_profiles` table; tightening the gate would re-introduce the bug where existing users are routed through all six `OwnerProfileStep` screens on sign-in even though their home is fully configured.
- **Keep all four paths**. Each defends a different failure mode (server-side, client-side stale flag, an active user who never opened the wizard, an owner whose wizard was interrupted).
- **If you remove the wizard, remove the gate entirely** instead. Leaving the gate without its `OwnerProfileStep` content would silently sign owners into a half-configured home.
- **If you change `onboardingProfileKey()`, retest the existing-user scenario**: sign in to a household whose `household_profiles` row has no `completed_at` **and** whose localStorage flag is empty. They must NOT see the wizard.

## Supabase setup

1. Create a Supabase project and run the SQL files in `supabase/migrations/` in filename order (or use `supabase db push`).
2. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key.
3. In Supabase Auth URL Configuration, set the Site URL to `https://fam-os.app/` and add redirect URLs for both production and local development:
   - `https://fam-os.app/**`
   - `http://localhost:5173/**`
   - `http://127.0.0.1:5173/**`
4. Add the branded invitation email secrets. `FAMOS_FROM_EMAIL` must use a domain verified in Resend:
   ```bash
   supabase secrets set RESEND_API_KEY=re_... FAMOS_FROM_EMAIL="FamOS <invites@fam-os.app>"
   ```
   To send optional transactional SMS invitations through Amazon SNS, add an IAM access key with `sns:Publish` permission:
   ```bash
   supabase secrets set \
     AWS_ACCESS_KEY_ID=... \
     AWS_SECRET_ACCESS_KEY=... \
     AWS_REGION=ca-central-1
   ```
   `AWS_SNS_SENDER_ID=FamOS` is optional and only applies in countries that support sender IDs.

   Before sending, activate **AWS End User Messaging SMS** in the same `AWS_REGION`, verify at least one sandbox destination, and send a console test. New accounts are sandboxed and can only message verified destinations until AWS approves SMS Production Access.

   A minimal IAM policy for the Supabase function key is:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "sns:Publish",
         "Resource": "*"
       }
     ]
   }
   ```
   The administrator configuring or inspecting the AWS SMS account also needs read access to AWS End User Messaging SMS, including `sms-voice:DescribeAccountAttributes`. Do not add administrator permissions to the key stored in Supabase.
5. Deploy the family invitation email function and the password/invite-OTP email function:
   ```bash
   supabase functions deploy send-family-invitation
   supabase functions deploy send-password-email
   supabase functions deploy prepare-invited-account
   ```
   Supabase automatically provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Both functions generate Supabase-secured links and use Resend for branded email delivery. `send-password-email` handles password resets and invitation OTP codes; `send-family-invitation` handles the full HTML invitation email for new members.
6. Configure Supabase Auth URL settings and make sure `https://fam-os.app/`, `http://localhost:5173`, and `http://127.0.0.1:5173` are allowed redirect URLs.
7. Start the app and sign in. New owners name their family, then can invite members immediately or skip and add them later from Settings. New invitees create a password from the secure link; existing users sign in and confirm the waiting household.

For inline invited-member password setup, paste `supabase/templates/magic_link.html` into **Authentication → Email Templates → Magic Link**. The `{{ .Token }}` variable is required: FamOS asks the member for this one-time code and never requires them to click an email link.

Never put a service-role key in this client application. The publishable key is safe to expose; row-level security protects household data.

## Customizing colors

Family member colors are defined once in `src/data/mockData.js` (`FAMILY_COLORS`) and as CSS variables in `src/index.css` (`--color-fam-*`). Add a new named color in both places and it becomes selectable in Settings automatically.

## Setting up Google Calendar sync (optional)

Family OS can pull events from your Google Calendar directly in the browser — no backend server involved, and it only ever *reads* your calendar (never writes to it). Because there's no server to hold a secret, each family creates its own free Google OAuth Client ID:

When Google is enabled as a Supabase Auth provider and the app uses **Continue with Google**, the same consent flow also grants read-only Calendar access. Add the Supabase Google callback URL to the Google OAuth client's authorized redirect URIs and configure that client ID and secret under Supabase **Authentication → Sign In / Providers → Google**.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project (or use an existing one).
2. Under **APIs & Services → Library**, search for **Google Calendar API** and enable it.
3. Under **APIs & Services → Credentials**, click **Create Credentials → OAuth client ID**.
   - Application type: **Web application**
   - Authorized JavaScript origins: add `https://fam-os.app`, `http://localhost:5173`, and `http://127.0.0.1:5173`.
   - If using Supabase Google Auth, also make sure the Supabase Google callback URL is listed under authorized redirect URIs.
4. Copy the generated **Client ID** (it ends in `.apps.googleusercontent.com`).
5. In Family OS, go to **Settings → Integrations → Google Calendar**, paste the Client ID, and tap **Connect Google Calendar**. Google will show its normal consent screen — approve read-only calendar access.

Notes:
- This uses Google Identity Services' token flow, meant for browser-only apps like this one. There's no refresh token, so the connection lasts for your browser session (about an hour) — reconnecting afterwards is one tap.
- Imported events show up in **Today** and **Calendar** with a small "Google" tag and can be filtered on/off, but can't be edited from Family OS (edit them in Google Calendar directly — changes will show up next sync).
- Your Client ID and connection state are saved locally so you don't have to re-paste it every visit.

### Opening Google Calendar authentication to all users

If Google Calendar auth is limited to selected accounts, the Google Cloud project is still in testing mode or is configured for an internal audience. For production:

1. In Google Cloud Console, open **Google Auth Platform → Audience**.
2. Set the user type/audience to **External** so anyone with a Google Account can authorize the app.
3. Publish the app from **Testing** to **Production** when it is ready.
4. In **Branding**, make sure the home page, privacy policy, terms page, and authorized domain use `https://fam-os.app/`.
5. In **Data Access**, request only the minimum Google Calendar scopes needed by the app. Calendar scopes may require Google verification before the app is broadly available.
6. In **Clients**, keep `https://fam-os.app` listed as an authorized JavaScript origin and keep the Supabase callback URL listed as an authorized redirect URI if Supabase Google Auth is enabled.

## API-key-backed Supabase Edge Functions

The following functions require a third-party API key set as a Supabase secret before deployment. Deploy each **after** setting its secrets.

### Recipe search (API Ninjas)

```bash
supabase secrets set RECIPE_API_NINJAS_KEY=your_api_ninjas_key
supabase functions deploy recipe-search
```

API Ninjas provides recipe data for Cook Mode, the meal suggestion roulette, and grocery-based meal idea suggestions. The function sends the key as the `X-Api-Key` header. The free tier returns up to 3 recipes per query and supports both recipe-name search (`title`) and ingredient-based search (`ingredients`) independently.

### Local event discovery (SerpApi + Ticketmaster, both optional)

The `search-local-events` function fans out across two providers in parallel:

```bash
#Paid — Google Events scraper (100 free searches/month, then paid tier)
supabase secrets set SERPAPI_KEY=your_serpapi_key

#Free — Ticketmaster Discovery API (5,000 calls/day, no paid tier needed)
supabase secrets set TICKETMASTER_API_KEY=your_ticketmaster_api_key

supabase functions deploy search-local-events
```

Results from both providers merge into a single deduped list. Each event carries a `provider` field (`google_events` or `ticketmaster`) so future UI can surface attribution. If only one provider is configured, the other is skipped silently — set neither and the function returns a clear error message about which key is missing. The free Ticketmaster tier covers ~5,000 family searches per day before any paid SerpApi quota is consumed.

### Weather forecasts

```bash
supabase secrets set WEATHERAPI_KEY=your_weatherapi_key
supabase functions deploy weather
```

Weather data powers the Today dashboard's weather card, including current conditions, alerts, and the 7-day forecast.

### Meal suggestions (Fam AI alternative)

```bash
supabase functions deploy meal-suggestions
```

A lightweight alternative to Fam AI that suggests meals based on available ingredients. Does not require a third-party API key.

### Recipe nutrition (API Ninjas)

```bash
supabase secrets set RECIPE_API_NINJAS_KEY=your_api_ninjas_key
supabase functions deploy recipe-nutrition
```

Uses the same API Ninjas key as `recipe-search`. Populates the cook mode nutrition panel with per-recipe calorie, protein, carb, and fat breakdowns. If the function source doesn't exist yet, create `supabase/functions/recipe-nutrition/index.ts` with the same Deno Edge Function pattern as the other functions, calling `https://api.api-ninjas.com/v1/nutrition` with the `X-Api-Key` header.

### Redeploy after secret changes

Whenever you update a secret, you **must** redeploy the function that uses it for the change to take effect:

```bash
supabase functions deploy recipe-search
supabase functions deploy search-local-events
supabase functions deploy weather
```

# Fam AI (Grok)

Fam AI uses a Supabase Edge Function so the xAI API key never ships to the browser. Configure and deploy it with:

```bash
supabase secrets set XAI_API_KEY=your_xai_api_key
supabase secrets set XAI_MODEL=grok-4.5
supabase functions deploy fam-ai
```

Grok proposes typed FamilyOS actions for tasks, groceries, events, and meals. The browser displays those actions for confirmation and executes them through the existing authenticated FamilyOS data layer only after approval.

## DoorDash grocery delivery (optional)

The grocery delivery flow is handled by the `doordash-grocery` Supabase Edge Function so DoorDash credentials stay server-side. Do not add live DoorDash credentials to `.env.local`, client code, or committed files.

Set the secrets in the live Supabase project:

```bash
supabase secrets set DOORDASH_DEVELOPER_ID=your_developer_id
supabase secrets set DOORDASH_KEY_ID=your_key_id
supabase secrets set DOORDASH_SIGNING_SECRET=your_signing_secret
```

Then configure the grocery stores FamilyOS can offer at checkout. The preferred format is a JSON array:

```bash
supabase secrets set DOORDASH_GROCERY_STORES='[
  {
    "id": "preferred-store",
    "name": "Preferred grocery store",
    "externalBusinessId": "your_doordash_external_business_id",
    "externalStoreId": "your_doordash_external_store_id",
    "pickupAddress": "123 Grocery St, Toronto, ON",
    "currency": "CAD"
  }
]'
```

Deploy or redeploy the function after the secrets are set:

```bash
supabase functions deploy doordash-grocery
```

Notes:
- The function creates DoorDash Drive quotes/deliveries and passes the grocery list as shopper instructions and item metadata.
- The current grocery subtotal is an app-side estimate unless a DoorDash-supported merchant catalog/pricing integration is connected.
- DoorDash delivery fees come from the live quote response when credentials and store settings are configured.
- For local testing against a non-production DoorDash base URL, set `DOORDASH_API_BASE` as another Supabase secret.
