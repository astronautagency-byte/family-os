alter table if exists public.kitchen_inventory
  add column if not exists category text not null default 'Other',
  add column if not exists brand text not null default '',
  add column if not exists barcode text,
  add column if not exists image_url text not null default '';

create index if not exists kitchen_inventory_category_idx
  on public.kitchen_inventory(household_id, category);
