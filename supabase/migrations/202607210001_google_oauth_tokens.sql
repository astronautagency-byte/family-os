-- Durable Google Calendar connection.
--
-- Problem: FamOS connects Google via Supabase OAuth and relies on the
-- session's `provider_token` (a Google access token). That token expires in
-- ~1 hour and Supabase never refreshes it, so the calendar silently appears to
-- disconnect. Google *does* return a long-lived `provider_refresh_token` once,
-- right after consent (because we request access_type=offline). We store that
-- refresh token here so the `google-calendar-token` edge function can mint a
-- fresh access token on demand — keeping the connection alive indefinitely.
--
-- Security: refresh tokens are secrets. RLS is enabled with NO policies for the
-- `authenticated` role, so only the service role (used inside the edge function)
-- can read or write them.

create table if not exists public.google_oauth_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  refresh_token text not null,
  scope text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.google_oauth_tokens enable row level security;

-- Intentionally no policies: the table is reachable only via the service-role
-- key inside the google-calendar-token edge function.
