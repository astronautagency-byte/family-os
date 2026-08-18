-- Add source column to meals table to track origin (manual, spoonacular, etc.)
alter table public.meals add column if not exists source text not null default 'manual';

-- Update existing meals that have Spoonacular recipe in notes to have source='spoonacular'
update public.meals set source = 'spoonacular' where notes like 'Spoonacular recipe%';

-- Add check constraint for valid sources
alter table public.meals add constraint meals_source_check check (source in ('manual', 'spoonacular', 'shared'));

-- Update the policy to use the new source column if needed (not needed for RLS)

-- Notify PostgREST to reload schema
select pg_notify('pgrst', 'reload schema');