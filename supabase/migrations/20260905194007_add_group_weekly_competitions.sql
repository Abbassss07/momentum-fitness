-- Four-week group competitions. Each cycle contains exactly four complete
-- Monday-Sunday weeks. The anchor makes 2026-08-31 the first week of the
-- rollout cycle; every fifth Monday is Week 1 of the following cycle.

create table public.group_weekly_winners (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  cycle_start date not null,
  cycle_number bigint not null,
  week_number smallint not null check (week_number between 1 and 4),
  week_start date not null,
  week_end date not null,
  winner_id uuid references public.profiles(id) on delete set null,
  winner_display_name text,
  active_days smallint not null default 0 check (active_days between 0 and 7),
  total_volume numeric(18, 2) not null default 0 check (total_volume >= 0),
  total_workouts integer not null default 0 check (total_workouts >= 0),
  tie_breaker text not null check (
    tie_breaker in ('active_days', 'volume', 'workouts', 'member_since', 'no_activity')
  ),
  finalized_at timestamptz not null default now(),
  unique (group_id, week_start),
  check (week_end = week_start + 6),
  check (week_start = cycle_start + ((week_number - 1) * 7))
);

comment on table public.group_weekly_winners is
  'Immutable weekly group results. Display names and scores are snapshotted when a week closes.';
comment on column public.group_weekly_winners.tie_breaker is
  'Metric that resolved first place. member_since is the deterministic final fallback for an exact tie.';

create index group_weekly_winners_cycle_idx
  on public.group_weekly_winners (group_id, cycle_start, week_number);
create index group_weekly_winners_winner_idx
  on public.group_weekly_winners (winner_id)
  where winner_id is not null;

alter table public.group_weekly_winners enable row level security;
revoke all on table public.group_weekly_winners from anon, authenticated;
grant select on table public.group_weekly_winners to authenticated;

create policy "Members can view group weekly winners"
on public.group_weekly_winners for select
to authenticated
using ((select private.is_group_member(group_id)));

create or replace function private.group_competition_period(reference_date date)
returns table (
  cycle_start date,
  cycle_end date,
  cycle_number bigint,
  week_start date,
  week_end date,
  week_number smallint
)
language sql
immutable
security invoker
set search_path = ''
as $function$
  with cycle_offset as (
    select floor(((reference_date - date '2026-08-31')::numeric) / 28)::bigint as value
  ), period as (
    select
      date '2026-08-31' + ((value * 28)::integer) as starts_on,
      value + 1 as number
    from cycle_offset
  ), competition_week as (
    select
      starts_on,
      number,
      floor(((reference_date - starts_on)::numeric) / 7)::integer + 1 as number_in_cycle
    from period
  )
  select
    starts_on,
    starts_on + 27,
    number,
    starts_on + ((number_in_cycle - 1) * 7),
    starts_on + ((number_in_cycle - 1) * 7) + 6,
    number_in_cycle::smallint
  from competition_week;
$function$;

revoke execute on function private.group_competition_period(date)
  from public, anon;
grant execute on function private.group_competition_period(date)
  to authenticated;

create or replace function private.finalize_group_week(
  target_group_id uuid,
  target_week_start date
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if target_week_start < date '2026-08-31'
     or extract(isodow from target_week_start) <> 1
     or target_week_start + 6 >= current_date then
    raise exception 'Only completed competition weeks can be finalized';
  end if;

  insert into public.group_weekly_winners (
    group_id,
    cycle_start,
    cycle_number,
    week_number,
    week_start,
    week_end,
    winner_id,
    winner_display_name,
    active_days,
    total_volume,
    total_workouts,
    tie_breaker
  )
  with period as (
    select * from private.group_competition_period(target_week_start)
  ), scores as (
    select
      member.user_id,
      member.joined_at,
      coalesce(nullif(trim(profile.display_name), ''), profile.username, 'Member') as display_name,
      count(distinct workout.logged_at)::smallint as active_days,
      coalesce(sum(coalesce(workout.weight_kg, 0) * workout.reps * workout.sets), 0)::numeric(18, 2) as total_volume,
      count(workout.id)::integer as total_workouts
    from public.group_members member
    join public.profiles profile on profile.id = member.user_id
    left join public.workout_logs workout
      on workout.user_id = member.user_id
      and workout.logged_at between target_week_start and target_week_start + 6
    where member.group_id = target_group_id
      and member.joined_at::date <= target_week_start + 6
    group by member.user_id, member.joined_at, profile.display_name, profile.username
  ), maximum as (
    select max(active_days) as active_days from scores
  ), day_leaders as (
    select scores.*
    from scores
    cross join maximum
    where scores.active_days = maximum.active_days
  ), tie_summary as (
    select
      count(*)::integer as tied_count,
      coalesce(min(total_volume), 0) as min_volume,
      coalesce(max(total_volume), 0) as max_volume,
      coalesce(min(total_workouts), 0) as min_workouts,
      coalesce(max(total_workouts), 0) as max_workouts
    from day_leaders
  ), ranked as (
    select
      scores.*,
      row_number() over (
        order by
          active_days desc,
          total_volume desc,
          case when total_volume = 0 then total_workouts else 0 end desc,
          joined_at asc,
          user_id asc
      ) as position
    from scores
  )
  select
    target_group_id,
    period.cycle_start,
    period.cycle_number,
    period.week_number,
    target_week_start,
    target_week_start + 6,
    case when ranked.active_days = 0 then null else ranked.user_id end,
    case when ranked.active_days = 0 then null else ranked.display_name end,
    ranked.active_days,
    ranked.total_volume,
    ranked.total_workouts,
    case
      when ranked.active_days = 0 then 'no_activity'
      when tie_summary.tied_count = 1 then 'active_days'
      when tie_summary.max_volume > tie_summary.min_volume then 'volume'
      when tie_summary.max_volume = 0
        and tie_summary.max_workouts > tie_summary.min_workouts then 'workouts'
      else 'member_since'
    end
  from ranked
  cross join period
  cross join tie_summary
  where ranked.position = 1
  on conflict (group_id, week_start) do nothing;
end;
$function$;

revoke execute on function private.finalize_group_week(uuid, date)
  from public, anon, authenticated;

create or replace function private.finalize_completed_group_weeks()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target record;
  finalized_count integer := 0;
begin
  for target in
    select competition_group.id as group_id, series.week_start::date
    from public.groups competition_group
    cross join lateral generate_series(
      greatest(
        date '2026-08-31',
        competition_group.created_at::date
          - (extract(isodow from competition_group.created_at::date)::integer - 1)
      )::timestamptz,
      (
        current_date
          - (extract(isodow from current_date)::integer - 1)
          - 7
      )::timestamptz,
      interval '7 days'
    ) as series(week_start)
    left join public.group_weekly_winners existing
      on existing.group_id = competition_group.id
      and existing.week_start = series.week_start::date
    where existing.id is null
      and series.week_start::date + 6 < current_date
  loop
    perform private.finalize_group_week(target.group_id, target.week_start);
    finalized_count := finalized_count + 1;
  end loop;

  return finalized_count;
end;
$function$;

revoke execute on function private.finalize_completed_group_weeks()
  from public, anon, authenticated;

create or replace function public.get_group_weekly_competition(
  target_group_id uuid,
  reference_date date default current_date
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not (select private.is_group_member(target_group_id)) then
    raise exception 'Group membership required';
  end if;
  if reference_date is null or abs(reference_date - current_date) > 1 then
    raise exception 'Competition date is invalid';
  end if;

  perform set_config('app.group_leaderboard_id', target_group_id::text, true);

  with period as (
    select * from private.group_competition_period(reference_date)
  ), scores as (
    select
      member.user_id,
      member.joined_at,
      coalesce(nullif(trim(profile.display_name), ''), profile.username, 'Member') as display_name,
      count(distinct workout.logged_at)::smallint as active_days,
      coalesce(sum(coalesce(workout.weight_kg, 0) * workout.reps * workout.sets), 0)::numeric(18, 2) as total_volume,
      count(workout.id)::integer as total_workouts
    from public.group_members member
    join public.profiles profile on profile.id = member.user_id
    cross join period
    left join public.workout_logs workout
      on workout.user_id = member.user_id
      and workout.logged_at between period.week_start and least(reference_date, period.week_end)
    where member.group_id = target_group_id
      and member.joined_at::date <= period.week_end
    group by member.user_id, member.joined_at, profile.display_name, profile.username
  ), maximum as (
    select max(active_days) as active_days from scores
  ), day_leaders as (
    select scores.*
    from scores
    cross join maximum
    where scores.active_days = maximum.active_days
  ), tie_summary as (
    select
      count(*)::integer as tied_count,
      coalesce(min(total_volume), 0) as min_volume,
      coalesce(max(total_volume), 0) as max_volume,
      coalesce(min(total_workouts), 0) as min_workouts,
      coalesce(max(total_workouts), 0) as max_workouts
    from day_leaders
  ), ranked as (
    select
      scores.*,
      row_number() over (
        order by
          active_days desc,
          total_volume desc,
          case when total_volume = 0 then total_workouts else 0 end desc,
          joined_at asc,
          user_id asc
      )::integer as position
    from scores
  ), leaderboard as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'rank', ranked.position,
        'userId', ranked.user_id,
        'displayName', ranked.display_name,
        'isCurrentUser', ranked.user_id = (select auth.uid()),
        'activeDays', ranked.active_days,
        'totalVolume', ranked.total_volume,
        'totalWorkouts', ranked.total_workouts
      ) order by ranked.position
    ), '[]'::jsonb) as value
    from ranked
  ), front_runner as (
    select case
      when ranked.active_days = 0 then null
      else jsonb_build_object(
        'rank', ranked.position,
        'userId', ranked.user_id,
        'displayName', ranked.display_name,
        'isCurrentUser', ranked.user_id = (select auth.uid()),
        'activeDays', ranked.active_days,
        'totalVolume', ranked.total_volume,
        'totalWorkouts', ranked.total_workouts
      )
    end as value
    from ranked
    where ranked.position = 1
  ), history as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'weekNumber', week_slot.number,
        'weekStart', period.cycle_start + ((week_slot.number - 1) * 7),
        'weekEnd', period.cycle_start + ((week_slot.number - 1) * 7) + 6,
        'status', case
          when winner.id is not null then 'finalized'
          when week_slot.number = period.week_number then 'in_progress'
          when week_slot.number > period.week_number then 'upcoming'
          else 'finalizing'
        end,
        'winnerId', winner.winner_id,
        'winnerDisplayName', winner.winner_display_name,
        'activeDays', winner.active_days,
        'totalVolume', winner.total_volume,
        'totalWorkouts', winner.total_workouts,
        'tieBreaker', winner.tie_breaker,
        'finalizedAt', winner.finalized_at
      ) order by week_slot.number
    ), '[]'::jsonb) as value
    from period
    cross join generate_series(1, 4) as week_slot(number)
    left join public.group_weekly_winners winner
      on winner.group_id = target_group_id
      and winner.cycle_start = period.cycle_start
      and winner.week_number = week_slot.number
  )
  select jsonb_build_object(
    'memberCount', (select count(*) from scores),
    'cycle', jsonb_build_object(
      'start', period.cycle_start,
      'end', period.cycle_end,
      'number', period.cycle_number
    ),
    'currentWeek', jsonb_build_object(
      'number', period.week_number,
      'start', period.week_start,
      'end', period.week_end
    ),
    'frontrunner', front_runner.value,
    'tieBreak', jsonb_build_object(
      'isActive', tie_summary.tied_count > 1 and maximum.active_days > 0,
      'tiedCount', case when maximum.active_days > 0 then tie_summary.tied_count else 0 end,
      'decidedBy', case
        when maximum.active_days = 0 then 'no_activity'
        when tie_summary.tied_count = 1 then 'active_days'
        when tie_summary.max_volume > tie_summary.min_volume then 'volume'
        when tie_summary.max_volume = 0
          and tie_summary.max_workouts > tie_summary.min_workouts then 'workouts'
        else 'member_since'
      end
    ),
    'leaderboard', leaderboard.value,
    'history', history.value
  )
  into result
  from period
  cross join maximum
  cross join tie_summary
  cross join leaderboard
  cross join front_runner
  cross join history;

  return result;
end;
$function$;

revoke execute on function public.get_group_weekly_competition(uuid, date)
  from public, anon;
grant execute on function public.get_group_weekly_competition(uuid, date)
  to authenticated;

-- pg_cron runs in UTC. At 00:05 every Monday, all elapsed Sunday-ended weeks
-- are frozen into the immutable history table.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'finalize-group-weekly-winners',
  '5 0 * * 1',
  'select private.finalize_completed_group_weeks();'
);

