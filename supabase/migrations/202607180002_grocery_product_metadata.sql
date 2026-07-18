alter table public.grocery_items
  add column if not exists barcode text,
  add column if not exists brand text not null default '',
  add column if not exists price numeric(10,2) check (price is null or price >= 0),
  add column if not exists image_url text not null default '';

create index if not exists grocery_items_barcode_idx
  on public.grocery_items (household_id, barcode)
  where barcode is not null;

notify pgrst, 'reload schema';
