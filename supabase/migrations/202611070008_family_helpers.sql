begin;
-- Repair older deployments whose migration history predates the actual
-- calendar container/task-list shape. Preserve existing rows and ownership.
create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null check(length(name) between 1 and 80), color text not null default '#6d4de8',
  created_by uuid not null references public.profiles(id),
  visibility text not null default 'household' check(visibility in ('household','selected','private','guardian_only')),
  selected_member_ids uuid[] not null default '{}', is_default boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.calendars enable row level security;
grant select,insert,update,delete on public.calendars to authenticated;
alter table public.task_lists add column if not exists visibility text not null default 'household' check(visibility in ('household','selected','private','guardian_only'));
alter table public.task_lists add column if not exists selected_member_ids uuid[] not null default '{}';
alter table public.events add column if not exists calendar_id uuid references public.calendars(id) on delete set null;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='calendars' and policyname='permission aware calendars') then
    create policy "permission aware calendars" on public.calendars for select to authenticated using(public.can_view_coordination_item(household_id,created_by,visibility,selected_member_ids));
    create policy "members create calendars" on public.calendars for insert to authenticated with check(public.is_household_member(household_id) and created_by=auth.uid());
    create policy "calendar creators update" on public.calendars for update to authenticated using(created_by=auth.uid()) with check(public.is_household_member(household_id) and created_by=auth.uid());
    create policy "calendar creators delete" on public.calendars for delete to authenticated using(created_by=auth.uid() and public.is_household_member(household_id));
  end if;
end $$;
-- Helpers are independent of household membership. No new direct table grants.
create table public.event_help_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  service text not null check(service in ('nanny','babysitting','housekeeping')),
  starts_at timestamptz not null, ends_at timestamptz not null,
  area text not null default '' check(length(area)<=120),
  requirements text not null default '' check(length(requirements)<=2000),
  budget text not null default '' check(length(budget)<=120),
  status text not null default 'draft' check(status in ('draft','confirmed','cancelled','completed')),
  created_at timestamptz not null default now(), check(ends_at>starts_at)
);
create table public.household_helper_access (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  request_id uuid references public.event_help_requests(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  invited_email text not null check(length(invited_email)<=254),
  name text not null check(length(name) between 1 and 80),
  preset text not null check(preset in ('nanny','housekeeping','custom')),
  state text not null default 'pending' check(state in ('pending','active','revoked','removed')),
  invite_hash text unique, invite_expires_at timestamptz not null,
  expires_at timestamptz not null, accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index helper_user_idx on public.household_helper_access(user_id);
create index helper_household_idx on public.household_helper_access(household_id);
create table public.helper_resource_grants (
  id uuid primary key default gen_random_uuid(),
  access_id uuid not null references public.household_helper_access(id) on delete cascade,
  household_calendar_id uuid references public.households(id) on delete cascade,
  calendar_id uuid references public.calendars(id) on delete cascade,
  task_list_id uuid references public.task_lists(id) on delete cascade,
  grocery_list_id uuid references public.grocery_lists(id) on delete cascade,
  shared_list_id uuid references public.shared_lists(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  permission text not null check(permission in ('view','complete')),
  check(num_nonnulls(household_calendar_id,calendar_id,task_list_id,grocery_list_id,shared_list_id,event_id)=1),
  check((household_calendar_id is null and calendar_id is null and event_id is null) or permission='view')
);
create table public.helper_access_audit (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  access_id uuid references public.household_helper_access(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null, resource_id uuid, created_at timestamptz not null default now()
);
alter table public.event_help_requests enable row level security;
alter table public.household_helper_access enable row level security;
alter table public.helper_resource_grants enable row level security;
alter table public.helper_access_audit enable row level security;
revoke all on public.event_help_requests,public.household_helper_access,public.helper_resource_grants,public.helper_access_audit from public,anon,authenticated;

-- Safe projections only; no provider IDs, participant directory, attachments or private fields.
create function public.helper_resource_catalog(h uuid) returns table(kind text,id uuid,name text)
language sql stable security definer set search_path='' as $$
  select 'family_calendar',x.id,'FamOS family calendar' from public.households x where x.id=h and x.created_by=auth.uid()
  union all select 'calendar',c.id,c.name from public.calendars c where c.household_id=h and c.created_by=auth.uid() and c.visibility='household'
  union all select 'tasks',l.id,l.name from public.task_lists l where l.household_id=h and l.created_by=auth.uid() and l.visibility='household'
  union all select 'groceries',l.id,l.name from public.grocery_lists l where l.household_id=h and l.created_by=auth.uid()
  union all select 'custom',l.id,l.title from public.shared_lists l where l.household_id=h and l.created_by=auth.uid() and l.visibility='household'
  union all select 'event',e.id,e.title from public.events e where e.household_id=h and e.created_by=auth.uid() and e.visibility='household' and e.source='familyos' and (e.calendar_id is null or exists(select 1 from public.calendars parent where parent.id=e.calendar_id and parent.household_id=h and parent.visibility='household'));
$$;
revoke all on function public.helper_resource_catalog(uuid) from public,anon,authenticated;

create function public.family_helpers(action text, h uuid, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.household_helper_access; r public.event_help_requests; g jsonb; token text; result jsonb; target uuid; expiry timestamptz; helper_id uuid;
begin
  if auth.uid() is null or not exists(select 1 from public.households where id=h and created_by=auth.uid()) then raise exception 'Family owner access required'; end if;
  if action='load' then
    return jsonb_build_object(
      'resources',coalesce((select jsonb_agg(to_jsonb(c) order by c.kind,c.name) from public.helper_resource_catalog(h) c),'[]'::jsonb),
      'helpers',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'email',x.invited_email,'preset',x.preset,'state',case when x.state in ('pending','active') and (x.expires_at<=now() or (x.state='pending' and x.invite_expires_at<=now())) then 'expired' else x.state end,'expires_at',x.expires_at,'request_id',x.request_id,'grants',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'kind',case when q.household_calendar_id is not null then 'family_calendar' when q.calendar_id is not null then 'calendar' when q.task_list_id is not null then 'tasks' when q.grocery_list_id is not null then 'groceries' when q.shared_list_id is not null then 'custom' else 'event' end,'resource_id',coalesce(q.household_calendar_id,q.calendar_id,q.task_list_id,q.grocery_list_id,q.shared_list_id,q.event_id),'permission',q.permission)),'[]'::jsonb) from public.helper_resource_grants q where q.access_id=x.id)) order by x.created_at desc) from public.household_helper_access x where x.household_id=h and x.state<>'removed'),'[]'::jsonb),
      'requests',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.event_help_requests x where x.household_id=h),'[]'::jsonb),
      'audit',coalesce((select jsonb_agg(to_jsonb(x)) from (select log.id,log.access_id,log.action,log.resource_id,log.created_at from public.helper_access_audit log where log.household_id=h order by log.created_at desc limit 30) x),'[]'::jsonb));
  elsif action='invite' then
    if length(trim(coalesce(payload->>'name',''))) not between 1 and 80 or coalesce(payload->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(payload->>'email')>254 then raise exception 'Enter a name and valid email'; end if;
    expiry:=(payload->>'expires_at')::timestamptz;
    if expiry is null or expiry<=now() or expiry>now()+interval '1 year' then raise exception 'Choose an expiry within the next year'; end if;
    if jsonb_typeof(payload->'grants')<>'array' or coalesce(jsonb_array_length(payload->'grants'),0) not between 1 and 30 then raise exception 'Select 1 to 30 resources'; end if;
    if payload->>'request_id' is not null then
      select * into r from public.event_help_requests where id=(payload->>'request_id')::uuid and household_id=h for update;
      if r.id is null or r.status<>'confirmed' then raise exception 'Confirm the arrangement before sharing access'; end if;
      if expiry>r.ends_at+interval '6 hours' then raise exception 'Event access must end within six hours of the job'; end if;
    end if;
    -- A new cryptographic token is returned once; only its hash is stored.
    token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
    insert into public.household_helper_access(household_id,request_id,invited_email,name,preset,invite_hash,invite_expires_at,expires_at)
    values(h,r.id,lower(trim(payload->>'email')),trim(payload->>'name'),payload->>'preset',encode(sha256(convert_to(token,'UTF8')),'hex'),least(now()+interval '7 days',expiry),expiry) returning * into a;
    for g in select value from jsonb_array_elements(payload->'grants') loop
      target:=(g->>'id')::uuid;
      if not exists(select 1 from public.helper_resource_catalog(h) c where c.kind=g->>'kind' and c.id=target) then raise exception 'Resource cannot be shared'; end if;
      if r.id is not null and (g->>'kind'<>'event' or target<>r.event_id) then raise exception 'Job access is limited to its selected event'; end if;
      insert into public.helper_resource_grants(access_id,household_calendar_id,calendar_id,task_list_id,grocery_list_id,shared_list_id,event_id,permission)
      values(a.id,case when g->>'kind'='family_calendar' then target end,case when g->>'kind'='calendar' then target end,case when g->>'kind'='tasks' then target end,case when g->>'kind'='groceries' then target end,case when g->>'kind'='custom' then target end,case when g->>'kind'='event' then target end,g->>'permission');
    end loop;
    insert into public.helper_access_audit(household_id,access_id,actor_id,action) values(h,a.id,auth.uid(),'invited');
    return jsonb_build_object('id',a.id,'token',token);
  elsif action in ('revoke','remove','revoke_resource') then
    select * into a from public.household_helper_access where id=(payload->>'id')::uuid and household_id=h for update;
    if a.id is null then raise exception 'Helper unavailable'; end if;
    if action='revoke_resource' then
      delete from public.helper_resource_grants where id=(payload->>'grant_id')::uuid and access_id=a.id;
      -- Pending links must never silently change their permission snapshot.
      if a.state='pending' or not exists(select 1 from public.helper_resource_grants where access_id=a.id) then
        update public.household_helper_access set state='revoked',invite_hash=null where id=a.id;
      end if;
    else
      update public.household_helper_access set state=case when action='remove' then 'removed' else 'revoked' end,invite_hash=null where id=a.id;
    end if;
    insert into public.helper_access_audit(household_id,access_id,actor_id,action) values(h,a.id,auth.uid(),action);
    return '{}'::jsonb;
  elsif action='request' then
    target:=(payload->>'event_id')::uuid;
    if not exists(select 1 from public.helper_resource_catalog(h) c where c.kind='event' and c.id=target) then raise exception 'Choose a shareable FamOS event you own'; end if;
    insert into public.event_help_requests(household_id,event_id,service,starts_at,ends_at,area,requirements,budget)
    values(h,target,payload->>'service',(payload->>'starts_at')::timestamptz,(payload->>'ends_at')::timestamptz,trim(coalesce(payload->>'area','')),trim(coalesce(payload->>'requirements','')),trim(coalesce(payload->>'budget',''))) returning id into target;
    insert into public.helper_access_audit(household_id,actor_id,action,resource_id) values(h,auth.uid(),'request_created',target);
    return jsonb_build_object('id',target);
  elsif action='request_status' then
    select * into r from public.event_help_requests where id=(payload->>'id')::uuid and household_id=h for update;
    if r.id is null or r.status in ('cancelled','completed') or not ((r.status='draft' and payload->>'status' in ('confirmed','cancelled')) or (r.status='confirmed' and payload->>'status' in ('completed','cancelled'))) then raise exception 'Invalid request transition'; end if;
    update public.event_help_requests set status=payload->>'status' where id=r.id;
    if payload->>'status' in ('cancelled','completed') then
      update public.household_helper_access set state='revoked',invite_hash=null where request_id=r.id and state in ('pending','active');
    end if;
    insert into public.helper_access_audit(household_id,actor_id,action,resource_id) values(h,auth.uid(),'request_'||(payload->>'status'),r.id);
    return '{}'::jsonb;
  end if;
  raise exception 'Unknown action';
end;
$$;
revoke all on function public.family_helpers(text,uuid,jsonb) from public,anon;
grant execute on function public.family_helpers(text,uuid,jsonb) to authenticated;

-- Projections re-check parent privacy on every read. A grant never overrides private items.
create function public.helper_shared_resources(access uuid) returns jsonb
language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(resource),'[]'::jsonb) from (
  select jsonb_build_object('grant_id',g.id,'kind','groceries','id',l.id,'name',l.name,'permission',g.permission,'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'title',i.name,'done',i.is_checked) order by i.created_at) from public.grocery_items i where i.list_id=l.id and i.household_id=a.household_id),'[]'::jsonb)) resource
  from public.helper_resource_grants g join public.household_helper_access a on a.id=g.access_id join public.grocery_lists l on l.id=g.grocery_list_id and l.household_id=a.household_id where g.access_id=access
  union all
  select jsonb_build_object('grant_id',g.id,'kind','tasks','id',l.id,'name',l.name,'permission',g.permission,'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,'done',i.is_done) order by i.created_at) from public.tasks i where i.list_id=l.id and i.household_id=a.household_id and i.visibility='household'),'[]'::jsonb))
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
revoke all on function public.helper_shared_resources(uuid) from public,anon,authenticated;

create function public.helper_portal(action text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.household_helper_access; g public.helper_resource_grants; result jsonb; email text; target uuid; changed integer;
begin
  select lower(u.email) into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
  if email is null then raise exception 'Sign in with your verified invitation email'; end if;
  if action in ('preview','accept') then
    select * into a from public.household_helper_access where invite_hash=encode(sha256(convert_to(coalesce(payload->>'token',''),'UTF8')),'hex') for update;
    if a.id is null or a.state<>'pending' or a.invited_email<>email or a.invite_expires_at<=now() or a.expires_at<=now() then raise exception 'Invitation unavailable for this account'; end if;
    if action='preview' then
      -- Preview resource names and permissions only, never content before acceptance.
      return jsonb_build_object('name',a.name,'family',(select name from public.households where id=a.household_id),'expires_at',a.expires_at,'resources',(select coalesce(jsonb_agg(jsonb_build_object('kind',x->>'kind','name',x->>'name','permission',x->>'permission')),'[]'::jsonb) from jsonb_array_elements(public.helper_shared_resources(a.id)) x));
    end if;
    update public.household_helper_access set user_id=auth.uid(),state='active',accepted_at=now(),invite_hash=null where id=a.id;
    insert into public.helper_access_audit(household_id,access_id,actor_id,action) values(a.household_id,a.id,auth.uid(),'accepted');
    return jsonb_build_object('id',a.id);
  elsif action='homes' then
    return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'family',h.name,'name',x.name,'expires_at',x.expires_at,'request_id',x.request_id)) from public.household_helper_access x join public.households h on h.id=x.household_id where x.user_id=auth.uid() and x.state='active' and x.expires_at>now()),'[]'::jsonb);
  end if;
  -- Share a row lock with writes so revocation cannot race a completion.
  select * into a from public.household_helper_access where id=(payload->>'id')::uuid and user_id=auth.uid() and state='active' and expires_at>now() for update;
  if a.id is null then raise exception 'Access ended or unavailable'; end if;
  if action='read' then
    return jsonb_build_object('family',(select name from public.households where id=a.household_id),'expires_at',a.expires_at,'resources',public.helper_shared_resources(a.id));
  elsif action='leave' then
    update public.household_helper_access set state='revoked',invite_hash=null where id=a.id;
    insert into public.helper_access_audit(household_id,access_id,actor_id,action) values(a.household_id,a.id,auth.uid(),'left');
    return '{}'::jsonb;
  elsif action='complete' then
    if jsonb_typeof(payload->'done') is distinct from 'boolean' then raise exception 'Completion must be true or false'; end if;
    select * into g from public.helper_resource_grants where id=(payload->>'grant_id')::uuid and access_id=a.id and permission='complete';
    if g.id is null then raise exception 'Completion not permitted'; end if;
    target:=(payload->>'item_id')::uuid;
    if g.grocery_list_id is not null then
      update public.grocery_items i set is_checked=(payload->>'done')::boolean where i.id=target and i.household_id=a.household_id and i.list_id=g.grocery_list_id and exists(select 1 from public.grocery_lists l where l.id=g.grocery_list_id and l.household_id=a.household_id);
    elsif g.task_list_id is not null then
      update public.tasks i set is_done=(payload->>'done')::boolean where i.id=target and i.household_id=a.household_id and i.list_id=g.task_list_id and i.visibility='household' and exists(select 1 from public.task_lists l where l.id=g.task_list_id and l.household_id=a.household_id and l.visibility='household');
    elsif g.shared_list_id is not null then
      update public.shared_list_items i set status=case when (payload->>'done')::boolean then 'completed' else 'open' end where i.id=target and i.list_id=g.shared_list_id and exists(select 1 from public.shared_lists l where l.id=g.shared_list_id and l.household_id=a.household_id and l.visibility='household');
    else raise exception 'Completion not permitted'; end if;
    get diagnostics changed=row_count;
    if changed<>1 then raise exception 'Item unavailable'; end if;
    insert into public.helper_access_audit(household_id,access_id,actor_id,action,resource_id) values(a.household_id,a.id,auth.uid(),case when (payload->>'done')::boolean then 'item_completed' else 'item_reopened' end,target);
    return '{}'::jsonb;
  end if;
  raise exception 'Unknown action';
end;
$$;
revoke all on function public.helper_portal(text,jsonb) from public,anon;
grant execute on function public.helper_portal(text,jsonb) to authenticated;

-- Cancelling or completing work revokes only that job's access bundles.
-- Deleting its event cascades through request/access/grants. General access survives.
notify pgrst, 'reload schema';

commit;
