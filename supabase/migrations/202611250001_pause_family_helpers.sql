begin;
-- Pause every externally callable helper path without deleting invitation,
-- grant, audit or family records. Restoring requires an explicit grant review.
do $$
declare entry record;
begin
  for entry in select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any(array[
      'family_helpers','helper_portal','helper_resource_catalog',
      'helper_shared_resources','invite_helper_passcode','helper_guest_login',
      'helper_guest_portal','claim_helper_sms'
    ])
  loop
    execute format('revoke execute on function %s from public, anon, authenticated, service_role',entry.signature);
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
