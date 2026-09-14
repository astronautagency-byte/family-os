-- RewardBank is an allowance ledger, never a payment processor.
create table public.rewardbank_settings (
 household_id uuid primary key references public.households(id) on delete cascade,
 enabled boolean not null default false
);
create table public.rewardbank_accounts (
 household_id uuid references public.households(id) on delete cascade,
 child_id uuid references public.profiles(id) on delete cascade,
 balance integer not null default 0 check(balance>=0),
 primary key(household_id,child_id)
);
create table public.rewardbank_rewards (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 120),
 kind text not null check(kind in ('experience','purchase','cash')),
 cost integer not null check(cost between 1 and 100000),
 details text not null default '' check(char_length(details)<=500)
);
create table public.rewardbank_chores (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null,
 child_id uuid not null,
 task_id uuid not null references public.tasks(id) on delete cascade,
 points integer not null check(points between 1 and 1000),
 approved_at timestamptz,
 foreign key(household_id,child_id) references public.rewardbank_accounts on delete cascade,
 unique(task_id,child_id)
);
create table public.rewardbank_redemptions (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null,
 child_id uuid not null,
 reward_id uuid not null references public.rewardbank_rewards(id),
 title text not null,
 cost integer not null,
 status text not null default 'requested' check(status in ('requested','fulfilled','declined')),
 created_at timestamptz not null default now(),
 foreign key(household_id,child_id) references public.rewardbank_accounts on delete cascade
);
create unique index rewardbank_one_pending_reward on public.rewardbank_redemptions(household_id,child_id,reward_id) where status='requested';
create table public.rewardbank_ledger (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null,
 child_id uuid not null,
 delta integer not null,
 note text not null,
 actor_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 foreign key(household_id,child_id) references public.rewardbank_accounts on delete cascade
);
create function public.rewardbank_is_parent(h uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.household_members where household_id=h and user_id=auth.uid() and role='owner');
$$;
revoke all on function public.rewardbank_is_parent(uuid) from public;
grant execute on function public.rewardbank_is_parent(uuid) to authenticated;
alter table public.rewardbank_settings enable row level security;
alter table public.rewardbank_accounts enable row level security;
alter table public.rewardbank_rewards enable row level security;
alter table public.rewardbank_chores enable row level security;
alter table public.rewardbank_redemptions enable row level security;
alter table public.rewardbank_ledger enable row level security;
revoke all on public.rewardbank_settings,public.rewardbank_accounts,public.rewardbank_rewards,public.rewardbank_chores,public.rewardbank_redemptions,public.rewardbank_ledger from anon,authenticated;
grant select on public.rewardbank_settings,public.rewardbank_accounts,public.rewardbank_rewards,public.rewardbank_chores,public.rewardbank_redemptions,public.rewardbank_ledger to authenticated;
create policy rewardbank_settings_read on public.rewardbank_settings for select to authenticated using(public.is_household_member(household_id));
create policy rewardbank_rewards_read on public.rewardbank_rewards for select to authenticated using(public.is_household_member(household_id));
create policy rewardbank_accounts_read on public.rewardbank_accounts for select to authenticated using(public.is_household_member(household_id) and (child_id=auth.uid() or public.rewardbank_is_parent(household_id)));
create policy rewardbank_chores_read on public.rewardbank_chores for select to authenticated using(public.is_household_member(household_id) and (child_id=auth.uid() or public.rewardbank_is_parent(household_id)));
create policy rewardbank_redemptions_read on public.rewardbank_redemptions for select to authenticated using(public.is_household_member(household_id) and (child_id=auth.uid() or public.rewardbank_is_parent(household_id)));
create policy rewardbank_ledger_read on public.rewardbank_ledger for select to authenticated using(public.is_household_member(household_id) and (child_id=auth.uid() or public.rewardbank_is_parent(household_id)));

-- All writes pass through one transactional command boundary. UI roles are not
-- authority; parent approval, points and balances are checked in the database.
create function public.rewardbank_command(h uuid, action text, payload jsonb default '{}') returns void
language plpgsql security definer set search_path='' as $$
declare
 parent boolean; child uuid; points integer; available integer; item public.rewardbank_rewards;
 chore public.rewardbank_chores; request_row public.rewardbank_redemptions; enabled_now boolean;
begin
 if auth.uid() is null or not public.is_household_member(h) then raise exception 'Household access required'; end if;
 parent:=public.rewardbank_is_parent(h);
 if action='enable' then
  if not parent then raise exception 'Only a household owner can manage RewardBank'; end if;
  insert into public.rewardbank_settings values(h,coalesce((payload->>'enabled')::boolean,false))
  on conflict(household_id) do update set enabled=excluded.enabled;
  return;
 end if;
 select enabled into enabled_now from public.rewardbank_settings where household_id=h for share;
 if not coalesce(enabled_now,false) then raise exception 'RewardBank is paused'; end if;
 if action in ('enroll','reward','chore','approve','fulfill','decline') and not parent then raise exception 'Parent approval required'; end if;
 if action='enroll' then
  child:=(payload->>'child_id')::uuid;
  if not exists(select 1 from public.household_members where household_id=h and user_id=child and role<>'owner') then raise exception 'Choose a household member who is not an owner'; end if;
  insert into public.rewardbank_accounts(household_id,child_id) values(h,child) on conflict do nothing;
 elsif action='reward' then
  insert into public.rewardbank_rewards(household_id,title,kind,cost,details) values(h,trim(payload->>'title'),payload->>'kind',(payload->>'cost')::integer,coalesce(payload->>'details',''));
 elsif action='chore' then
  child:=(payload->>'child_id')::uuid;
  if not exists(select 1 from public.tasks where id=(payload->>'task_id')::uuid and household_id=h and not is_done and (assignee_id=child or child=any(assignee_ids))) then raise exception 'Choose an unfinished task assigned to this child'; end if;
  insert into public.rewardbank_chores(household_id,child_id,task_id,points) values(h,child,(payload->>'task_id')::uuid,(payload->>'points')::integer)
  on conflict(task_id,child_id) do update set points=excluded.points where rewardbank_chores.approved_at is null;
 elsif action='approve' then
  select * into chore from public.rewardbank_chores where id=(payload->>'id')::uuid and household_id=h for update;
  if not found then raise exception 'Chore not found'; end if;
  if chore.approved_at is not null then return; end if;
  if not exists(select 1 from public.tasks where id=chore.task_id and household_id=h and is_done and (assignee_id=chore.child_id or chore.child_id=any(assignee_ids))) then raise exception 'The assigned child must complete the task first'; end if;
  update public.rewardbank_accounts set balance=balance+chore.points where household_id=h and child_id=chore.child_id;
  update public.rewardbank_chores set approved_at=now() where id=chore.id;
  insert into public.rewardbank_ledger(household_id,child_id,delta,note,actor_id) values(h,chore.child_id,chore.points,'Chore approved',auth.uid());
 elsif action='redeem' then
  child:=auth.uid();
  select * into item from public.rewardbank_rewards where id=(payload->>'reward_id')::uuid and household_id=h;
  if not found then raise exception 'Reward not found'; end if;
  select balance into available from public.rewardbank_accounts where household_id=h and child_id=child for update;
  if not found or available<item.cost then raise exception 'Not enough available points'; end if;
  insert into public.rewardbank_redemptions(household_id,child_id,reward_id,title,cost) values(h,child,item.id,item.title,item.cost);
  update public.rewardbank_accounts set balance=balance-item.cost where household_id=h and child_id=child;
  insert into public.rewardbank_ledger(household_id,child_id,delta,note,actor_id) values(h,child,-item.cost,'Reserved for '||item.title,auth.uid());
 elsif action in ('fulfill','decline') then
  select * into request_row from public.rewardbank_redemptions where id=(payload->>'id')::uuid and household_id=h for update;
  if not found then raise exception 'Request not found'; end if;
  if request_row.status<>'requested' then return; end if;
  update public.rewardbank_redemptions set status=case when action='fulfill' then 'fulfilled' else 'declined' end where id=request_row.id;
  if action='decline' then
   update public.rewardbank_accounts set balance=balance+request_row.cost where household_id=h and child_id=request_row.child_id;
   insert into public.rewardbank_ledger(household_id,child_id,delta,note,actor_id) values(h,request_row.child_id,request_row.cost,'Returned: '||request_row.title,auth.uid());
  end if;
 else raise exception 'Unknown RewardBank action';
 end if;
end;
$$;
revoke all on function public.rewardbank_command(uuid,text,jsonb) from public,anon;
grant execute on function public.rewardbank_command(uuid,text,jsonb) to authenticated;
