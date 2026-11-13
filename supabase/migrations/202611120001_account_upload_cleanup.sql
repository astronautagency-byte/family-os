begin;

-- Return only uploads belonging to the account or to a household it owns.
-- The caller removes these via the Storage API, which also removes the blob.
create function public.account_upload_cleanup_batch(account_id uuid)
returns table(bucket_id text, object_name text)
language sql stable security definer set search_path = ''
as $$
  select object.bucket_id, object.name
  from storage.objects as object
  where object.bucket_id in ('grocery-photos', 'support-screenshots', 'broadcast-voice')
    and (
      object.owner_id = account_id::text
      or (object.bucket_id = 'support-screenshots' and split_part(object.name, '/', 1) = account_id::text)
      or (object.bucket_id = 'broadcast-voice' and split_part(object.name, '/', 2) = account_id::text)
      or (
        object.bucket_id in ('grocery-photos', 'broadcast-voice')
        and exists (
          select 1 from public.households as household
          where household.created_by = account_id
            and household.id::text = split_part(object.name, '/', 1)
        )
      )
    )
  order by object.bucket_id, object.name
  limit 100
$$;

revoke all on function public.account_upload_cleanup_batch(uuid) from public, anon, authenticated;
grant execute on function public.account_upload_cleanup_batch(uuid) to service_role;

alter function public.delete_own_account() rename to delete_own_account_records;
revoke all on function public.delete_own_account_records() from public, anon, authenticated, service_role;

-- Older clients can still delete accounts with no outstanding uploads.
create function public.delete_own_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
begin
  if account_id is null then
    raise exception 'Authentication required';
  end if;
  if exists (select 1 from public.account_upload_cleanup_batch(account_id)) then
    raise exception 'Update FamOS or use the website to delete your account and uploads.';
  end if;
  perform public.delete_own_account_records();
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

commit;
