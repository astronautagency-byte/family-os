-- Optional household-entered store label; existing grocery RLS applies.
alter table public.grocery_items add column if not exists preferred_store text not null default '';
