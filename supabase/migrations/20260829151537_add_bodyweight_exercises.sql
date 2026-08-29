alter table public.exercises
  add column if not exists is_bodyweight boolean not null default false;

update public.exercises
set is_bodyweight = true
where user_id is null
  and name in ('Push-up', 'Pull-up', 'Hanging Leg Raise');

alter table public.workout_logs
  alter column weight_kg drop not null;

comment on column public.exercises.is_bodyweight is
  'Whether workout load is optional because the movement primarily uses body weight.';

comment on column public.workout_logs.weight_kg is
  'External load in kilograms; null represents an unweighted bodyweight exercise.';
