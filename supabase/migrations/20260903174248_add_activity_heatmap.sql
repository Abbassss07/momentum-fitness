-- Returns a contiguous, RLS-protected 30-day activity series for the caller.
-- `workout_logs.logged_at` is a calendar date, so no timestamp conversion is
-- needed when grouping a user's exercise entries.
create index if not exists workout_logs_user_logged_at_exercise_idx
  on public.workout_logs (user_id, logged_at, exercise_id);

create or replace function public.get_activity_heatmap()
returns table (
  activity_date date,
  exercise_count integer,
  activity_level smallint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with days as (
    select day::date as activity_date
    from generate_series(
      current_date - interval '29 days',
      current_date,
      interval '1 day'
    ) as day
  ),
  logged_exercises as (
    select
      workout.logged_at as activity_date,
      count(distinct workout.exercise_id)::integer as exercise_count
    from public.workout_logs as workout
    where workout.user_id = (select auth.uid())
      and workout.logged_at >= current_date - 29
      and workout.logged_at <= current_date
    group by workout.logged_at
  )
  select
    days.activity_date,
    coalesce(logged_exercises.exercise_count, 0) as exercise_count,
    case
      when coalesce(logged_exercises.exercise_count, 0) = 0 then 0
      when logged_exercises.exercise_count <= 3 then 1
      when logged_exercises.exercise_count <= 5 then 2
      else 3
    end::smallint as activity_level
  from days
  left join logged_exercises using (activity_date)
  order by days.activity_date;
$$;

revoke all on function public.get_activity_heatmap() from public;
grant execute on function public.get_activity_heatmap() to authenticated;
