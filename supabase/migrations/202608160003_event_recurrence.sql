alter table public.events
  add column if not exists recurrence text not null default 'none',
  add column if not exists recurrence_until date;

alter table public.events
  drop constraint if exists events_recurrence_check;

alter table public.events
  add constraint events_recurrence_check
  check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly'));
