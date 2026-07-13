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

## Supabase setup

1. Create a Supabase project and run the SQL files in `supabase/migrations/` in filename order (or use `supabase db push`).
2. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key.
3. In Supabase Auth URL Configuration, set the Site URL and add local/deployed redirect URLs (for example `http://localhost:5173/**`).
4. Start the app and sign in by email. The first user creates a household and can invite their partner from Settings.

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
   - Authorized JavaScript origins: add the URL you'll run Family OS from, e.g. `http://localhost:5173` for local dev, or your deployed `https://…` URL.
4. Copy the generated **Client ID** (it ends in `.apps.googleusercontent.com`).
5. In Family OS, go to **Settings → Integrations → Google Calendar**, paste the Client ID, and tap **Connect Google Calendar**. Google will show its normal consent screen — approve read-only calendar access.

Notes:
- This uses Google Identity Services' token flow, meant for browser-only apps like this one. There's no refresh token, so the connection lasts for your browser session (about an hour) — reconnecting afterwards is one tap.
- Imported events show up in **Today** and **Calendar** with a small "Google" tag and can be filtered on/off, but can't be edited from Family OS (edit them in Google Calendar directly — changes will show up next sync).
- Your Client ID and connection state are saved locally so you don't have to re-paste it every visit.
