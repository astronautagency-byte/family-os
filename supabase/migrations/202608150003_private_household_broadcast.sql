-- Low-latency, household-private change fan-out.
--
-- Postgres Changes remains enabled as a recovery path. These triggers add the
-- Supabase-recommended Broadcast path so sibling devices receive a committed
-- household change without waiting for the filtered logical-replication feed.

drop policy if exists "household members receive household broadcasts" on realtime.messages;
create policy "household members receive household broadcasts"
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = auth.uid()
      and realtime.topic() = 'household:' || hm.household_id::text || ':changes'
  )
);

create or replace function public.broadcast_household_change()
returns trigger
security definer
set search_path = ''
language plpgsql
as $$
declare
  target_household uuid;
begin
  if TG_OP = 'DELETE' then
    target_household := OLD.household_id;
  else
    target_household := NEW.household_id;
  end if;

  perform realtime.broadcast_changes(
    'household:' || target_household::text || ':changes',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  return null;
end;
$$;

do $$
declare
  household_tables text[] := array[
    'tasks',
    'task_lists',
    'grocery_items',
    'events',
    'meals',
    'messages',
    'message_reactions',
    'expenses',
    'kitchen_inventory'
  ];
  table_name text;
begin
  foreach table_name in array household_tables loop
    if to_regclass('public.' || table_name) is null then
      continue;
    end if;
    execute format('drop trigger if exists broadcast_household_change on public.%I', table_name);
    execute format(
      'create trigger broadcast_household_change after insert or update or delete on public.%I for each row execute function public.broadcast_household_change()',
      table_name
    );
  end loop;
end
$$ language plpgsql;
