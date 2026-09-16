-- Supabase can grant anon/authenticated EXECUTE through default privileges.
-- Revoking PUBLIC alone does not remove those direct grants.
revoke all on function public.clean_family_pack(jsonb), public.publish_family_pack(uuid,jsonb), public.preview_family_pack(text), public.revoke_family_pack(uuid), public.import_family_pack(text,uuid,date) from public, anon, authenticated;
grant execute on function public.preview_family_pack(text) to anon, authenticated;
grant execute on function public.publish_family_pack(uuid,jsonb), public.revoke_family_pack(uuid), public.import_family_pack(text,uuid,date) to authenticated;
