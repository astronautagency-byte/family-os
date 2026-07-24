-- Cross-member realtime sync hardening.
--
-- Why this migration exists: Supabase realtime evaluates the postgres_changes
-- filter (e.g. `household_id=eq.xyz`) against the WAL payload. With the
-- Postgres default REPLICA IDENTITY, a DELETE only writes the primary key
-- into the WAL — so the realtime server has no household_id to compare
-- against the filter and SILENTLY DROPS the event. That is the actual cause
-- of the perceived "delay" when one family member removes a task / deletes a
-- meal / clears a broadcast: the OTHER member's UI never receives the delete
-- update because the realtime event was filtered out server-side.
--
-- Insert and update payloads always include the new row, which is fine, so
-- those events flow correctly today. It's only the deletes that vanish.
--
-- Fix: REPLICA IDENTITY FULL makes Postgres include the full old row in the
-- WAL on update + delete, let the realtime filter evaluate correctly, and
-- deliver the event to every subscribed household device.
--
-- This migration is also defensive: it re-adds the table to the
-- supabase_realtime publication if a future schema change accidentally
-- orphaned it. Idempotent + safe to re-run.

do $$
declare
  -- Every household-scoped table whose changes need to reach family devices
  -- in real time. `event_participants` is omitted because the parent event's
  -- INSERT/UPDATE/DELETE already covers the participant UI; grocers' barcode
  -- / price columns live on grocery_items which is already included.
  house_tables text[] := array[
    'tasks',
    'grocery_items',
    'events',
    'messages',
    'meals',
    'expenses',
    'message_reactions'
  ];
  t text;
begin
  foreach t in array house_tables loop
    -- 1. Skip tables that do not exist (e.g. message_reactions may have
    --    not been applied yet on a brand-new project, or a feature was
    --    rolled back). We do NOT want the migration to fail mid-loop.
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relkind = 'r'
    ) then
      continue;
    end if;

    -- 2. Upgrade replica identity so UPDATE old + DELETE payloads include
    --    every column, not just the primary key. Required for filtered
    --    realtime events (household_id must be present in the WAL row for
    --    the filter to evaluate).
    execute format('alter table public.%I replica identity full;', t);

    -- 3. Defensively re-add to the realtime publication if it was ever
    --    removed by a future operation. No-op when already present.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I;', t);
    end if;
  end loop;
end
$$ language plpgsql;
