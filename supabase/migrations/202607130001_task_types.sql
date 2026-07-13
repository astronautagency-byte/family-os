alter table public.tasks
  add column if not exists task_type text not null default 'home';

alter table public.tasks
  drop constraint if exists tasks_task_type_check;

alter table public.tasks
  add constraint tasks_task_type_check
  check (task_type in ('home', 'errand', 'family', 'work', 'personal'));
