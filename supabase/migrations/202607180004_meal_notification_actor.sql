alter table public.meals
  add column if not exists created_by uuid references public.profiles(id);

notify pgrst, 'reload schema';
