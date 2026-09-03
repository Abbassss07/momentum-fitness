-- Use the entire current calendar month instead of a rolling window.
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
  with month_bounds as (
    select
      date_trunc('month', current_date)::date as month_start,
      (date_trunc('month', current_date) + interval '1 month')::date as next_month_start
  ),
  days as (
    select day::date as activity_date
    from month_bounds,
      generate_series(
        month_start,
        next_month_start - interval '1 day',
        interval '1 day'
      ) as day
  ),
  logged_exercises as (
    select
      workout.logged_at as activity_date,
      count(distinct workout.exercise_id)::integer as exercise_count
    from public.workout_logs as workout
    cross join month_bounds
    where workout.user_id = (select auth.uid())
      and workout.logged_at >= month_bounds.month_start
      and workout.logged_at < month_bounds.next_month_start
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
