-- Allow product ideas submitted from Settings to share the existing
-- privacy-protected support inbox and admin workflow.
alter table public.support_messages
  drop constraint if exists support_messages_category_check;

alter table public.support_messages
  add constraint support_messages_category_check
  check (category in ('email', 'bug', 'ticket', 'feature'));
