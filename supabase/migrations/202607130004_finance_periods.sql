alter table public.household_finance_settings
  add column if not exists monthly_budget numeric(12,2) not null default 0 check (monthly_budget >= 0);

alter table public.household_finance_settings
  add column if not exists tracking_period text not null default 'weekly';

alter table public.household_finance_settings
  drop constraint if exists household_finance_settings_tracking_period_check;

alter table public.household_finance_settings
  add constraint household_finance_settings_tracking_period_check
  check (tracking_period in ('weekly', 'monthly'));

notify pgrst, 'reload schema';
