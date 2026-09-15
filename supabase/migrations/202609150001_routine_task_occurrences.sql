-- Ordinary tasks remain unchanged; routine completions create exactly one next occurrence.
alter table public.tasks add column if not exists routine_previous_task_id uuid references public.tasks(id) on delete set null;
create unique index if not exists tasks_routine_previous_unique on public.tasks(routine_previous_task_id) where routine_previous_task_id is not null;
create or replace function public.advance_famos_routine() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare next_day date;
begin
  if old.is_done or not new.is_done or new.due_date is null or new.recurrence not in ('routine:daily','routine:weekdays','routine:weekly','routine:monthly') then return new; end if;
  next_day := case new.recurrence when 'routine:weekly' then new.due_date + 7 when 'routine:monthly' then (new.due_date + interval '1 month')::date else new.due_date + 1 end;
  if new.recurrence = 'routine:weekdays' then
    while extract(isodow from next_day) in (6,7) loop next_day := next_day + 1; end loop;
  end if;
  -- Copy only the task the caller was authorized to complete; no caller-supplied owner or scope.
  insert into public.tasks(household_id,title,notes,assignee_id,assignee_ids,due_date,recurrence,task_type,list_id,created_by,visibility,selected_member_ids,routine_previous_task_id)
  values(new.household_id,new.title,new.notes,new.assignee_id,new.assignee_ids,next_day,new.recurrence,new.task_type,new.list_id,new.created_by,new.visibility,new.selected_member_ids,new.id)
  on conflict (routine_previous_task_id) where routine_previous_task_id is not null do nothing;
  return new;
end;
$$;
revoke all on function public.advance_famos_routine() from public, anon, authenticated;
drop trigger if exists advance_famos_routine_on_completion on public.tasks;
create trigger advance_famos_routine_on_completion after update of is_done on public.tasks
for each row execute function public.advance_famos_routine();
