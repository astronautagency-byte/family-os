-- Add thumbnail column to meals table to store recipe images
alter table public.meals add column if not exists thumbnail text not null default '';

-- Notify PostgREST to reload schema
select pg_notify('pgrst', 'reload schema');
