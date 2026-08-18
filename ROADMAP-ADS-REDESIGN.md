# FamOS: UI Redesign + Ads + Partner Portal Roadmap

## Vision
Transform FamOS into a GrowMaple-inspired premium family app with native ad monetization for free accounts and a self-serve partner dashboard.

---

## Phase 1: Ad Infrastructure (Foundation)
**Goal:** Build the ad system before the UI redesign so ads integrate cleanly.

### 1.1 Database Schema
```sql
-- Partners table
CREATE TABLE ad_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  logo_url TEXT,
  website_url TEXT,
  status TEXT DEFAULT 'pending', -- pending, active, paused, rejected
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ad campaigns
CREATE TABLE ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES ad_partners(id),
  name TEXT NOT NULL,
  headline TEXT NOT NULL,
  body_text TEXT,
  cta_text TEXT DEFAULT 'Learn more',
  cta_url TEXT NOT NULL,
  image_url TEXT,
  placements TEXT[] DEFAULT '{home}', -- home, calendar, meals, shopping, tasks
  status TEXT DEFAULT 'draft', -- draft, active, paused, ended
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  budget_cents INTEGER,
  spent_cents INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ad impressions tracking
CREATE TABLE ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES ad_campaigns(id),
  user_id UUID REFERENCES auth.users(id),
  placement TEXT NOT NULL,
  clicked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 1.2 Ad Component
- `NativeAdBanner` — reusable component matching FamOS design system
- Props: `placement`, `variant` (banner/card/inline), `size` (compact/standard)
- Renders partner creative with "Sponsored" label + "Remove ads" upsell link
- Only shows for free-tier users (checks `subscription_status` from Chargebee)

### 1.3 Ad Visibility Logic
- Free users: See ads on all 5 placements
- Plus/Pro users: No ads
- Check via `has_household_feature()` or direct Chargebee subscription lookup

---

## Phase 2: Partner Dashboard (Self-Serve)
**Goal:** Partners can log in, create campaigns, upload creatives, view analytics.

### 2.1 Partner Auth
- Separate auth flow: `partners.fam-os.app` subdomain or `/partner/login`
- Email + password auth (Supabase auth with `partner` role)
- Partner invitation flow (admin creates partner account, sends invite email)

### 2.2 Partner Dashboard Pages
- **Campaigns List** — All campaigns with status, metrics
- **Create Campaign** — Form: name, headline, body, CTA, image upload, placement selection, date range, budget
- **Campaign Detail** — Live metrics (impressions, clicks, CTR), status toggle
- **Billing** — Usage-based billing (impressions * CPM rate)

### 2.3 Admin Panel (FamOS Admin)
- Partner management (approve/reject partners)
- Campaign review/approval queue
- Revenue dashboard (total impressions, partner revenue)
- Ad placement configuration

---

## Phase 3: UI Redesign (GrowMaple-Inspired)
**Goal:** Transform all pages to match GrowMaple's clean, minimal, premium aesthetic.

### Design System Changes
- **Background:** Warm white (`#FAFAF8`) or light cream
- **Cards:** Soft rounded corners (`border-radius: 16px`), subtle border, no harsh shadows
- **Typography:** Friendly sans-serif (Plus Jakarta Sans or similar)
- **Colors:** Muted sage/teal accents, warm grays
- **Spacing:** Generous whitespace, breathable layouts
- **Icons:** Lighter stroke weight, more refined

### 3.1 Home/Today Page
- Greeting + date header
- Summary cards (events, tasks, meals, messages) — clean list rows with chevrons
- AI quick-action input ("What do you want to do?")
- **Ad placement:** Native banner below greeting, above summary

### 3.2 Calendar
- Clean week/month grid with soft borders
- Event chips with category colors
- **Ad placement:** Below calendar grid, before event list

### 3.3 Meals
- Weekly meal grid (Breakfast/Lunch/Dinner × Days)
- Recipe cards with photos
- **Ad placement:** Between meal slots or below meal plan

### 3.4 Shopping
- Minimal checklist with quantity controls
- Category sections with soft dividers
- **Ad placement:** Below grocery list, before "Previously added"

### 3.5 Tasks
- Clean checklist with assignee avatars
- List tabs (All, Personal, Shared)
- **Ad placement:** Below task list

### 3.6 Kitchen Watch
- Grouped expiry cards (Expired, Expiring Soon, Good)
- Progress bars for shelf life
- No ad here (premium experience)

### 3.7 Chat
- Clean message bubbles
- AI assistant integration
- No ad here (premium experience)

---

## Phase 4: Integration & Launch
**Goal:** Wire everything together, test, launch.

### 4.1 Ad Frequency & Targeting
- Max 1 ad per page per session
- Frequency capping (3 impressions per user per day per campaign)
- Basic targeting: geography, family size

### 4.2 Premium Upsell
- "Remove ads" CTA on every ad → links to Settings > Billing
- Free users see ads, Plus/Pro users don't
- Clear value proposition: "Upgrade to remove ads + unlock features"

### 4.3 Analytics
- Partner dashboard: impressions, clicks, CTR per campaign
- Admin dashboard: total ad revenue, partner metrics
- User-facing: no analytics (privacy-first)

---

## Phase 3.5: DiceBear Avatar System
**Goal:** Replace basic initials avatars with DiceBear's rich avatar library.

### Avatar Options
Users can choose from 3 sources:
1. **DiceBear avatars** — Curated styles with deterministic seed (same name = same avatar)
2. **Photo upload** — Camera or gallery (existing functionality)
3. **Initials** — Fallback with color background

### Recommended DiceBear Styles (Family-Friendly)
| Style | Vibe | URL Pattern |
|-------|------|-------------|
| `adventurer-neutral` | Friendly characters | `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Alex` |
| `notionists-neutral` | Clean minimal | `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=Alex` |
| `fun-emoji` | Playful (kids) | `https://api.dicebear.com/9.x/fun-emoji/svg?seed=Alex` |
| `bottts-neutral` | Cute robots | `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Alex` |
| `lorelei-neutral` | Soft illustrated | `https://api.dicebear.com/9.x/lorelei-neutral/svg?seed=Alex` |
| `identicon` | Abstract geometric | `https://api.dicebear.com/9.x/identicon/svg?seed=Alex` |

### Implementation
- `AvatarPicker` component: grid of style options + upload button + initials option
- Store `avatar_style` + `avatar_seed` in profiles table (or `avatar_url` for uploads)
- DiceBear HTTP API — no API key needed, SVG output, deterministic via seed
- On profile creation: auto-generate avatar from name seed, user can change later

---

## Execution Order
1. **Phase 1** (Ad Infrastructure) — 2-3 days
2. **Phase 2** (Partner Dashboard) — 3-4 days
3. **Phase 3** (UI Redesign) — 5-7 days (page by page)
4. **Phase 4** (Integration) — 1-2 days

**Total estimated timeline: 11-16 days**

---

## Key Decisions Needed
- [ ] Ad image dimensions (recommend: 1200x628 for banner, 1080x1080 for card)
- [ ] CPM rate for partners (recommend: $5-10 CPM for family audience)
- [ ] Partner pricing model (pay-per-impression vs flat monthly)
- [ ] Whether to use a third-party ad server or build custom
- [ ] Subdomain for partner portal (partners.fam-os.app vs /partner route)
