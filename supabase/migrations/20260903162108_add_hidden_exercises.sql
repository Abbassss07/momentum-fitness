create table public.hidden_exercises (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

comment on table public.hidden_exercises is
  'Per-user exercise library removals. Hiding an exercise never deletes workout history or the shared exercise definition.';

alter table public.hidden_exercises enable row level security;

grant select, insert, delete on table public.hidden_exercises to authenticated;

create policy "Users can view own hidden exercises"
on public.hidden_exercises
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can hide exercises in own library"
on public.hidden_exercises
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can restore own hidden exercises"
on public.hidden_exercises
for delete
to authenticated
using ((select auth.uid()) = user_id);
