-- Human-reviewed capture queue. Parsed content is always a draft until explicitly approved.
create table if not exists public.capture_drafts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  source_name text not null default 'Quick capture',
  source_type text not null default 'text' check (source_type in ('text','document','image','email')),
  items jsonb not null default '[]'::jsonb,
  confidence text not null default 'needs_review' check (confidence in ('high','needs_review','low')),
  status text not null default 'pending' check (status in ('pending','approved','discarded')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.capture_drafts enable row level security;
create policy "guardians read capture drafts" on public.capture_drafts for select to authenticated using
  (public.can_view_coordination_item(household_id,created_by,'guardian_only','{}'::uuid[]));
create policy "members create own capture drafts" on public.capture_drafts for insert to authenticated with check
  (public.is_household_member(household_id) and created_by=auth.uid());
create policy "guardians resolve capture drafts" on public.capture_drafts for update to authenticated using
  (public.can_view_coordination_item(household_id,created_by,'guardian_only','{}'::uuid[]));
create index if not exists capture_drafts_pending_idx on public.capture_drafts(household_id,status,created_at desc);
