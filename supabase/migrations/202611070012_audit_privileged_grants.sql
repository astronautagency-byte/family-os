-- Restore least-privilege execution without invoking functions or changing business data.
begin;
do $$ declare f record;begin
 for f in select p.oid,p.proname,p.prorettype,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and (p.proname like 'admin\_%' escape '\' or p.proname in ('upsert_from_stripe','upsert_from_chargebee')) loop
  execute format('revoke execute on function public.%I(%s) from public,anon',f.proname,f.args);
  if f.proname in ('upsert_from_stripe','upsert_from_chargebee') then
   execute format('revoke execute on function public.%I(%s) from authenticated',f.proname,f.args);
  elsif f.prorettype<>'pg_catalog.trigger'::regtype then
   execute format('grant execute on function public.%I(%s) to authenticated',f.proname,f.args);
  end if;
  execute format('grant execute on function public.%I(%s) to service_role',f.proname,f.args);
 end loop;
end $$;
alter view public.onboarding_email_stats set (security_invoker=true);
commit;
