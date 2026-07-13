-- FamilyOS shared backend: private households, collaboration data, and RLS.
create extension if not exists pgcrypto;

create type public.household_role as enum ('owner', 'member');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  color text not null default 'coral',
  initials text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our family',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.household_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null,
  invited_by uuid not null references public.profiles(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  unique (household_id, email)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  is_done boolean not null default false,
  recurrence text not null default '',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  category text not null default 'Other',
  quantity numeric(8,2) not null default 1 check (quantity > 0),
  unit text not null default '',
  is_checked boolean not null default false,
  added_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default '',
  source text not null default 'familyos' check (source in ('familyos', 'google')),
  external_id text,
  external_calendar_id text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (household_id, source, external_id)
);

create table public.event_participants (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (event_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index household_members_user_idx on public.household_members(user_id);
create index tasks_household_due_idx on public.tasks(household_id, due_date);
create index groceries_household_idx on public.grocery_items(household_id, is_checked, created_at);
create index events_household_start_idx on public.events(household_id, starts_at);
create index messages_household_created_idx on public.messages(household_id, created_at);

create function public.set_updated_at() returns trigger language plpgsql security invoker as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger households_updated before update on public.households for each row execute function public.set_updated_at();
create trigger tasks_updated before update on public.tasks for each row execute function public.set_updated_at();
create trigger groceries_updated before update on public.grocery_items for each row execute function public.set_updated_at();
create trigger events_updated before update on public.events for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name, initials)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data ->> 'display_name', new.email, '?'), 2))
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create function public.is_household_member(target_household uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid()
  );
$$;

create function public.shares_household(target_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs using (household_id)
    where mine.user_id = auth.uid() and theirs.user_id = target_user
  );
$$;

create function public.create_household(household_name text default 'Our family')
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'You already belong to a household';
  end if;
  insert into public.households(name, created_by)
  values (coalesce(nullif(trim(household_name), ''), 'Our family'), auth.uid()) returning id into new_id;
  insert into public.household_members(household_id, user_id, role)
  values (new_id, auth.uid(), 'owner');
  return new_id;
end;
$$;

create function public.accept_household_invitation(invitation_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invitation public.household_invitations;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into invitation from public.household_invitations
  where id = invitation_id and accepted_at is null and expires_at > now();
  if not found then raise exception 'Invitation is invalid or expired'; end if;
  if lower(invitation.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'Invitation belongs to another email address';
  end if;
  if (select count(*) from public.household_members where household_id = invitation.household_id) >= 2 then
    raise exception 'This household already has two members';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'You already belong to a household';
  end if;
  insert into public.household_members(household_id, user_id, role)
  values (invitation.household_id, auth.uid(), 'member');
  update public.household_invitations set accepted_at = now() where id = invitation_id;
  return invitation.household_id;
end;
$$;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.accept_household_invitation(uuid) to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.shares_household(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;
alter table public.tasks enable row level security;
alter table public.grocery_items enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.messages enable row level security;

create policy "profiles visible to household" on public.profiles for select to authenticated using (
  id = auth.uid() or public.shares_household(id)
);
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "members view household" on public.households for select to authenticated using (public.is_household_member(id));
create policy "owners update household" on public.households for update to authenticated using (
  exists (select 1 from public.household_members where household_id = id and user_id = auth.uid() and role = 'owner')
);

create policy "members view memberships" on public.household_members for select to authenticated using (public.is_household_member(household_id));

create policy "members view invitations" on public.household_invitations for select to authenticated using (
  public.is_household_member(household_id) or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
create policy "members create invitations" on public.household_invitations for insert to authenticated with check (
  public.is_household_member(household_id) and invited_by = auth.uid()
);
create policy "members delete invitations" on public.household_invitations for delete to authenticated using (public.is_household_member(household_id));

create policy "household tasks" on public.tasks for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
create policy "household groceries" on public.grocery_items for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
create policy "household events" on public.events for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
create policy "household participants" on public.event_participants for all to authenticated
using (exists (select 1 from public.events where id = event_id and public.is_household_member(household_id)))
with check (exists (select 1 from public.events where id = event_id and public.is_household_member(household_id)));
create policy "household messages read" on public.messages for select to authenticated using (public.is_household_member(household_id));
create policy "household messages send" on public.messages for insert to authenticated
with check (public.is_household_member(household_id) and sender_id = auth.uid());

alter publication supabase_realtime add table public.tasks, public.grocery_items, public.events, public.event_participants, public.messages;
