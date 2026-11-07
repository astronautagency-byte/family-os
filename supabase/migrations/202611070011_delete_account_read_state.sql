-- A user's announcement read/dismiss state must not prevent account erasure.
begin;
alter table public.product_update_reads drop constraint product_update_reads_user_id_fkey;
alter table public.product_update_reads add constraint product_update_reads_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
commit;
