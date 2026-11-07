begin;
alter table public.task_lists add column routine_cadence text not null default 'none' check(routine_cadence in ('none','daily','weekdays'));
alter table public.task_lists add column routine_timezone text not null default 'UTC';
create function public.validate_task_list_routine_timezone() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from pg_timezone_names where name=new.routine_timezone) then raise exception 'Choose a valid routine timezone';end if;return new;
end $$;
revoke all on function public.validate_task_list_routine_timezone() from public,anon,authenticated;
create trigger validate_task_list_routine_timezone before insert or update of routine_timezone on public.task_lists for each row execute function public.validate_task_list_routine_timezone();
create function public.inherit_task_list_routine() returns trigger language plpgsql security definer set search_path='' as $$
declare l public.task_lists;
begin
 if new.list_id is not null then
  select * into l from public.task_lists where id=new.list_id and household_id=new.household_id;
  if l.routine_cadence in ('daily','weekdays') then
   new.recurrence:='routine:'||l.routine_cadence;
   new.due_date:=coalesce(new.due_date,(now() at time zone l.routine_timezone)::date);
   if l.routine_cadence='weekdays' then while extract(isodow from new.due_date) in (6,7) loop new.due_date:=new.due_date+1;end loop;end if;
  end if;
 end if;return new;
end $$;
revoke all on function public.inherit_task_list_routine() from public,anon,authenticated;
create trigger inherit_task_list_routine before insert on public.tasks for each row execute function public.inherit_task_list_routine();
create or replace function public.advance_famos_routine() returns trigger language plpgsql security definer set search_path='' as $$
declare next_day date; base_day date; l public.task_lists;
begin
 if old.is_done or not new.is_done or new.due_date is null or new.recurrence not in ('routine:daily','routine:weekdays','routine:weekly','routine:monthly') then return new;end if;
 base_day:=new.due_date;
 select * into l from public.task_lists where id=new.list_id and household_id=new.household_id;
 if l.routine_cadence in ('daily','weekdays') then base_day:=greatest(base_day,(now() at time zone l.routine_timezone)::date);end if;
 next_day:=case new.recurrence when 'routine:weekly' then base_day+7 when 'routine:monthly' then (base_day+interval '1 month')::date else base_day+1 end;
 if new.recurrence='routine:weekdays' then while extract(isodow from next_day) in (6,7) loop next_day:=next_day+1;end loop;end if;
 insert into public.tasks(household_id,title,notes,assignee_id,assignee_ids,due_date,recurrence,task_type,list_id,created_by,visibility,selected_member_ids,routine_previous_task_id)
 values(new.household_id,new.title,new.notes,new.assignee_id,new.assignee_ids,next_day,new.recurrence,new.task_type,new.list_id,new.created_by,new.visibility,new.selected_member_ids,new.id)
 on conflict(routine_previous_task_id) where routine_previous_task_id is not null do nothing;
 return new;
end $$;
revoke all on function public.advance_famos_routine() from public,anon,authenticated;
drop trigger if exists advance_famos_routine_on_completion on public.tasks;
create trigger advance_famos_routine_on_completion after update of is_done on public.tasks for each row execute function public.advance_famos_routine();
create function public.configure_task_list_routine(list uuid,cadence text,tz text) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.task_lists;day date;
begin
 select * into l from public.task_lists where id=list and created_by=auth.uid() and public.is_household_member(household_id) for update;
 if l.id is null then raise exception 'Only the list creator can change its routine';end if;
 if cadence not in ('none','daily','weekdays') or cadence is null or not exists(select 1 from pg_timezone_names where name=tz) then raise exception 'Choose a valid repeat schedule and timezone';end if;
 if cadence<>'none' and l.routine_cadence=cadence and l.routine_timezone=tz then return to_jsonb(l);end if;
 day:=(now() at time zone tz)::date;
 if cadence='weekdays' then while extract(isodow from day) in (6,7) loop day:=day+1;end loop;end if;
 update public.task_lists set routine_cadence=cadence,routine_timezone=tz where id=l.id;
 if cadence='none' then update public.tasks set recurrence='' where list_id=l.id and household_id=l.household_id and not is_done and visibility='household';
 else
  update public.tasks set recurrence='routine:'||cadence,due_date=day where list_id=l.id and household_id=l.household_id and not is_done and visibility='household';
  -- Start a fresh occurrence for completed leaf items; preserve completed history.
  insert into public.tasks(household_id,title,notes,assignee_id,assignee_ids,due_date,recurrence,task_type,list_id,created_by,visibility,selected_member_ids,routine_previous_task_id)
  select t.household_id,t.title,t.notes,t.assignee_id,t.assignee_ids,day,'routine:'||cadence,t.task_type,t.list_id,t.created_by,t.visibility,t.selected_member_ids,t.id
  from public.tasks t where t.list_id=l.id and t.household_id=l.household_id and t.is_done and t.visibility='household' and not exists(select 1 from public.tasks child where child.routine_previous_task_id=t.id)
  on conflict(routine_previous_task_id) where routine_previous_task_id is not null do nothing;
 end if;
 return (select to_jsonb(x) from public.task_lists x where x.id=l.id);
end $$;
revoke all on function public.configure_task_list_routine(uuid,text,text) from public,anon;
grant execute on function public.configure_task_list_routine(uuid,text,text) to authenticated;
create or replace function public.helper_shared_resources(access uuid) returns jsonb
language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(resource),'[]'::jsonb) from (
  select jsonb_build_object('grant_id',g.id,'kind','groceries','id',l.id,'name',l.name,'permission',g.permission,'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'title',i.name,'done',i.is_checked) order by i.created_at) from public.grocery_items i where i.list_id=l.id and i.household_id=a.household_id),'[]'::jsonb)) resource
  from public.helper_resource_grants g join public.household_helper_access a on a.id=g.access_id join public.grocery_lists l on l.id=g.grocery_list_id and l.household_id=a.household_id where g.access_id=access
  union all
  select jsonb_build_object('grant_id',g.id,'kind','tasks','id',l.id,'name',l.name,'permission',g.permission,'routine_cadence',l.routine_cadence,'routine_day',(now() at time zone l.routine_timezone)::date,'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,'done',i.is_done,'due',i.due_date,'recurrence',i.recurrence,'notes',i.notes) order by i.created_at) from public.tasks i where i.list_id=l.id and i.household_id=a.household_id and i.visibility='household' and (coalesce(i.recurrence,'') not like 'routine:%' or (i.due_date<=(now() at time zone l.routine_timezone)::date and (i.recurrence<>'routine:weekdays' or extract(isodow from (now() at time zone l.routine_timezone)::date)<6) and (not i.is_done or i.due_date=(now() at time zone l.routine_timezone)::date)))),'[]'::jsonb))
  from public.helper_resource_grants g join public.household_helper_access a on a.id=g.access_id join public.task_lists l on l.id=g.task_list_id and l.household_id=a.household_id and l.visibility='household' where g.access_id=access
  union all
  select jsonb_build_object('grant_id',g.id,'kind','custom','id',l.id,'name',l.title,'permission',g.permission,'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,'done',i.status='completed') order by i.sequence,i.created_at) from public.shared_list_items i where i.list_id=l.id),'[]'::jsonb))
  from public.helper_resource_grants g join public.household_helper_access a on a.id=g.access_id join public.shared_lists l on l.id=g.shared_list_id and l.household_id=a.household_id and l.visibility='household' where g.access_id=access
  union all
  select jsonb_build_object('grant_id',g.id,'kind','calendar','id',l.id,'name',l.name,'permission','view','items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,'start',i.starts_at,'end',i.ends_at,'recurrence',i.recurrence,'recurrenceUntil',i.recurrence_until) order by i.starts_at) from public.events i where i.calendar_id=l.id and i.household_id=a.household_id and i.visibility='household' and i.source='familyos'),'[]'::jsonb))
  from public.helper_resource_grants g join public.household_helper_access a on a.id=g.access_id join public.calendars l on l.id=g.calendar_id and l.household_id=a.household_id and l.visibility='household' where g.access_id=access
  union all
  select jsonb_build_object('grant_id',g.id,'kind','family_calendar','id',a.household_id,'name','FamOS family calendar','permission','view','items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,'start',i.starts_at,'end',i.ends_at,'recurrence',i.recurrence,'recurrenceUntil',i.recurrence_until) order by i.starts_at) from public.events i where i.calendar_id is null and i.household_id=a.household_id and i.visibility='household' and i.source='familyos'),'[]'::jsonb))
  from public.helper_resource_grants g join public.household_helper_access a on a.id=g.access_id where g.access_id=access and g.household_calendar_id=a.household_id
  union all
  select jsonb_build_object('grant_id',g.id,'kind','event','id',e.id,'name',e.title,'permission','view','items',jsonb_build_array(jsonb_build_object('id',e.id,'title',e.title,'start',coalesce(job.starts_at,e.starts_at),'end',coalesce(job.ends_at,e.ends_at),'recurrence',case when job.id is null then e.recurrence else 'none' end,'recurrenceUntil',e.recurrence_until)))
  from public.helper_resource_grants g join public.household_helper_access a on a.id=g.access_id join public.events e on e.id=g.event_id and e.household_id=a.household_id and e.visibility='household' and e.source='familyos' left join public.event_help_requests job on job.id=a.request_id where g.access_id=access and (e.calendar_id is null or exists(select 1 from public.calendars parent where parent.id=e.calendar_id and parent.household_id=a.household_id and parent.visibility='household'))
) s;
$$;

-- Mutation checks match the projection: future routine occurrences cannot be checked off early.
do $$
declare f record; definition text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('helper_portal','helper_guest_portal') loop
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(definition,'l.id=g.task_list_id and l.household_id=a.household_id and l.visibility=''household'')','l.id=g.task_list_id and l.household_id=a.household_id and l.visibility=''household'' and (coalesce(i.recurrence,'''') not like ''routine:%'' or (i.due_date<=(now() at time zone l.routine_timezone)::date and (i.recurrence<>''routine:weekdays'' or extract(isodow from (now() at time zone l.routine_timezone)::date)<6))))');
  execute definition;
 end loop;
end $$;
commit;
