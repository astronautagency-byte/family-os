alter table public.expenses
  add column if not exists merchant text,
  add column if not exists receipt_notes text,
  add column if not exists receipt_confidence numeric(5,2),
  add column if not exists receipt_source text not null default 'manual';

alter table public.expenses
  drop constraint if exists expenses_receipt_source_check;

alter table public.expenses
  add constraint expenses_receipt_source_check
  check (receipt_source in ('manual', 'photo', 'photo_review', 'text_review', 'ai_receipt'));
