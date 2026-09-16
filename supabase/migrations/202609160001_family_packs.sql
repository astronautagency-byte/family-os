-- Unlisted snapshots, never live access to another household. No billing dependency.
create table public.family_packs (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 created_by uuid not null references public.profiles(id),
 token text not null unique default replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),
 payload jsonb not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '90 days'),
 revoked_at timestamptz
);
create table public.family_pack_imports (
 pack_id uuid not null references public.family_packs(id) on delete cascade,
 household_id uuid not null references public.households(id) on delete cascade,
 imported_by uuid not null references public.profiles(id),
 imported_at timestamptz not null default now(),
 primary key(pack_id,household_id)
);
alter table public.family_packs enable row level security;
alter table public.family_pack_imports enable row level security;
revoke all on public.family_packs, public.family_pack_imports from anon,authenticated;
grant select on public.family_packs to authenticated;
create policy family_packs_owner_read on public.family_packs for select to authenticated
 using(public.rewardbank_is_parent(household_id));

-- Reject unknown fields on the server too: client sanitization is not a security boundary.
create function public.clean_family_pack(p jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare k text:=p->>'kind'; result jsonb; items jsonb:='[]'; item jsonb; entry jsonb; recipe jsonb; cleaned jsonb; field text; value jsonb; source text;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>100000
 or k is null or k not in ('tasks','routines','recipes','meals')
 or jsonb_typeof(p->'title') is distinct from 'string' or length(trim(p->>'title')) not between 1 and 80
 or jsonb_typeof(p->'items') is distinct from 'array' then raise exception 'Invalid pack'; end if;
 if jsonb_array_length(p->'items') not between 1 and 30 then raise exception 'Choose 1–30 items'; end if;
 for item in select * from jsonb_array_elements(p->'items') loop
  if jsonb_typeof(item->'title') is distinct from 'string' or length(trim(item->>'title')) not between 1 and 200 then raise exception 'Invalid item name'; end if;
  entry:=jsonb_build_object('title',trim(item->>'title'));
  if k='routines' then
   if item->>'cadence' is null or item->>'cadence' not in ('daily','weekdays','weekly','monthly') then raise exception 'Invalid cadence'; end if;
   if jsonb_typeof(item->'steps') is distinct from 'array' then raise exception 'Invalid routine steps'; end if;
   if jsonb_array_length(item->'steps')>12 then raise exception 'Too many routine steps'; end if;
   for value in select * from jsonb_array_elements(item->'steps') loop
    if jsonb_typeof(value)<>'string' or length(value#>>'{}')>1000 then raise exception 'Invalid step'; end if;
   end loop;
   entry:=entry||jsonb_build_object('cadence',item->>'cadence','steps',item->'steps');
  end if;
  if k='meals' then
   if coalesce(item->>'day','') !~ '^([0-9]|1[0-3])$' or item->>'slot' is null or item->>'slot' not in ('breakfast','lunch','dinner') then raise exception 'Invalid meal slot'; end if;
   entry:=entry||jsonb_build_object('day',(item->>'day')::int,'slot',item->>'slot');
  end if;
  if k='recipes' or (k='meals' and item ? 'recipe') then
   recipe:=item->'recipe';cleaned:='{}';
   foreach field in array array['ingredients','instructions'] loop
    if jsonb_typeof(recipe->field) is distinct from 'array' then raise exception 'Invalid recipe'; end if;
    if jsonb_array_length(recipe->field) not between 1 and 60 then raise exception 'Invalid recipe length'; end if;
    for value in select * from jsonb_array_elements(recipe->field) loop
     if jsonb_typeof(value)<>'string' or length(trim(value#>>'{}')) not between 1 and 1000 then raise exception 'Invalid recipe text'; end if;
    end loop;
    cleaned:=cleaned||jsonb_build_object(field,recipe->field);
   end loop;
   foreach field in array array['servings','readyInMinutes'] loop
    if recipe->field is not null and recipe->field<>'null'::jsonb then
     if jsonb_typeof(recipe->field)<>'number' or (recipe->>field)::numeric<=0 or (recipe->>field)::numeric>10000 then raise exception 'Invalid recipe quantity'; end if;
     cleaned:=cleaned||jsonb_build_object(field,recipe->field);
    end if;
   end loop;
   source:=coalesce(recipe->>'sourceUrl','');
   -- No credentials, query tokens, fragments, or uploaded images in public packs.
   if length(source)>2000 or (source<>'' and source !~ '^https://[^/@?#[:space:]]+(/[^?#[:space:]]*)?$') then raise exception 'Use a public HTTPS source URL without query parameters'; end if;
   if length(coalesce(recipe->>'sourceName',''))>200 then raise exception 'Source name too long'; end if;
   cleaned:=cleaned||jsonb_build_object('sourceUrl',source,'sourceName',coalesce(recipe->>'sourceName',''));
   entry:=entry||jsonb_build_object('recipe',cleaned);
  end if;
  items:=items||jsonb_build_array(entry);
 end loop;
 if k='meals' and (select count(*)<>count(distinct (x->>'day',x->>'slot')) from jsonb_array_elements(items) x) then raise exception 'Duplicate meal slots'; end if;
 return jsonb_build_object('version',1,'kind',k,'title',trim(p->>'title'),'items',items);
end $$;

create function public.publish_family_pack(h uuid,p jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare t text; cleaned jsonb;
begin
 if not public.rewardbank_is_parent(h) then raise exception 'Only a household owner can publish packs'; end if;
 if exists(select 1 from public.household_feature_preferences where household_id=h and features->>'family_packs'='false') then raise exception 'Enable Family Packs in Family Settings first'; end if;
 -- Serialize quota checks for this household.
 perform 1 from public.households where id=h for update;
 if (select count(*) from public.family_packs where household_id=h and revoked_at is null and expires_at>now())>=20 then raise exception 'Revoke an old link before creating another (20 active links maximum)'; end if;
 cleaned:=public.clean_family_pack(p);
 if exists(select 1 from public.household_feature_preferences where household_id=h and features->>(case when cleaned->>'kind'='routines' then 'tasks' else cleaned->>'kind' end)='false') then raise exception 'Enable the source page in Family Settings first'; end if;
 insert into public.family_packs(household_id,created_by,payload) values(h,auth.uid(),cleaned) returning token into t;
 return t;
end $$;
create function public.preview_family_pack(t text) returns jsonb
language sql stable security definer set search_path='' as $$
 select payload from public.family_packs where token=t and length(t)=64 and revoked_at is null and expires_at>now();
$$;
create function public.revoke_family_pack(pack uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.family_packs set revoked_at=coalesce(revoked_at,now()) where id=pack and public.rewardbank_is_parent(household_id);
 if not found then raise exception 'Pack unavailable or not owned by your household'; end if;
end $$;
create function public.import_family_pack(t text,h uuid,start_date date default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.family_packs; item jsonb; list uuid; k text; recipe jsonb; n int:=0;
begin
 if not public.rewardbank_is_parent(h) then raise exception 'Only a household owner can import packs'; end if;
 if exists(select 1 from public.household_feature_preferences where household_id=h and features->>'family_packs'='false') then raise exception 'Enable Family Packs in Family Settings first'; end if;
 select * into p from public.family_packs where token=t and revoked_at is null and expires_at>now() for share;
 if not found then raise exception 'This link is unavailable or expired'; end if;
 k:=p.payload->>'kind';
 if exists(select 1 from public.household_feature_preferences where household_id=h and features->>(case when k='routines' then 'tasks' else k end)='false') then raise exception 'Enable the destination page in Family Settings first'; end if;
 if k in ('meals','routines') and (start_date is null or start_date<current_date or start_date>current_date+365) then raise exception 'Choose a start date within the next year'; end if;
 insert into public.family_pack_imports(pack_id,household_id,imported_by) values(p.id,h,auth.uid()) on conflict do nothing;
 if not found then return jsonb_build_object('alreadyImported',true,'kind',k); end if;
 if k in ('tasks','routines') then
  insert into public.task_lists(household_id,name,created_by) values(h,p.payload->>'title',auth.uid()) returning id into list;
 end if;
 for item in select * from jsonb_array_elements(p.payload->'items') loop
  if k in ('tasks','routines') then
   insert into public.tasks(household_id,title,created_by,list_id,recurrence,due_date,notes)
    values(h,item->>'title',auth.uid(),list,case when k='routines' then 'routine:'||(item->>'cadence') else '' end,
     case when k='routines' then start_date else null end,
     case when k='routines' then (select coalesce(string_agg(value,E'\n'),'') from jsonb_array_elements_text(item->'steps')) else '' end);
  elsif k='recipes' then
   recipe:=(item->'recipe')||jsonb_build_object('title',item->>'title','source','Family Pack');
   insert into public.household_recipes(household_id,created_by,title,recipe) values(h,auth.uid(),item->>'title',recipe);
  elsif k='meals' then
   -- Plain INSERT deliberately fails on existing slots; the whole import rolls back.
   insert into public.meals(household_id,meal_date,slot,title,created_by,recipe_snapshot)
    values(h,start_date+(item->>'day')::int,item->>'slot',item->>'title',auth.uid(),
     case when item ? 'recipe' then (item->'recipe')||jsonb_build_object('title',item->>'title','source','Family Pack') else null end);
  end if;
  n:=n+1;
 end loop;
 return jsonb_build_object('alreadyImported',false,'kind',k,'count',n);
exception when unique_violation then raise exception 'A meal is already planned in one of these slots. Choose another start date. Nothing was imported.';
end $$;
revoke all on function public.clean_family_pack(jsonb), public.publish_family_pack(uuid,jsonb), public.preview_family_pack(text), public.revoke_family_pack(uuid), public.import_family_pack(text,uuid,date) from public;
grant execute on function public.preview_family_pack(text) to anon,authenticated;
grant execute on function public.publish_family_pack(uuid,jsonb),public.revoke_family_pack(uuid),public.import_family_pack(text,uuid,date) to authenticated;

-- Preserve existing customization while adding an independently hideable sharing feature.
create or replace function public.set_household_features(h uuid, selection jsonb, pause boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.rewardbank_is_parent(h) then raise exception 'Only the household owner can customize FamOS'; end if;
 if selection is null or jsonb_typeof(selection)<>'object' or exists(
  select 1 from jsonb_each(selection) e where e.key not in ('calendar','tasks','groceries','kitchen','meals','recipes','rewards','chat','fam_ai','insights','celebrations','routine_suggestions','family_packs') or jsonb_typeof(e.value)<>'boolean'
 ) then raise exception 'Invalid feature selection'; end if;
 insert into public.household_feature_preferences(household_id,features,pause_reminders) values(h,selection,coalesce(pause,false))
 on conflict(household_id) do update set features=excluded.features,pause_reminders=excluded.pause_reminders,updated_at=now();
end $$;
revoke all on function public.set_household_features(uuid,jsonb,boolean) from public,anon;
grant execute on function public.set_household_features(uuid,jsonb,boolean) to authenticated;
