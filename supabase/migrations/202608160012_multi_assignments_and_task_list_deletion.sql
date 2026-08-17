-- Shared ownership for household work and shopping. Keep the legacy single
-- task assignee populated for older clients while new clients use assignee_ids.
alter table public.tasks add column if not exists assignee_ids uuid[] not null default '{}'::uuid[];
update public.tasks set assignee_ids = array[assignee_id] where assignee_id is not null and cardinality(assignee_ids) = 0;
alter table public.grocery_items add column if not exists assignee_ids uuid[] not null default '{}'::uuid[];

create index if not exists tasks_assignee_ids_idx on public.tasks using gin(assignee_ids);
create index if not exists grocery_items_assignee_ids_idx on public.grocery_items using gin(assignee_ids);

create or replace function public.validate_household_assignee_ids()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from unnest(coalesce(new.assignee_ids, '{}'::uuid[])) as assigned(user_id)
    where not exists (
      select 1
      from public.household_members member
      where member.household_id = new.household_id
        and member.user_id = assigned.user_id
    )
  ) then
    raise exception 'Every assignee must belong to this household';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_task_assignee_ids on public.tasks;
create trigger validate_task_assignee_ids
before insert or update of household_id, assignee_ids on public.tasks
for each row execute function public.validate_household_assignee_ids();

drop trigger if exists validate_grocery_assignee_ids on public.grocery_items;
create trigger validate_grocery_assignee_ids
before insert or update of household_id, assignee_ids on public.grocery_items
for each row execute function public.validate_household_assignee_ids();

drop policy if exists "task list creators delete" on public.task_lists;
create policy "household members delete task lists" on public.task_lists for delete to authenticated
  using (public.is_household_member(household_id));
