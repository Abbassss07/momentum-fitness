create schema if not exists private;

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_code text not null default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_at timestamptz not null default now(),
  constraint groups_name_length_check check (char_length(trim(name)) between 2 and 80),
  constraint groups_invite_code_format_check check (invite_code ~ '^[a-z0-9]{10}$'),
  constraint groups_invite_code_key unique (invite_code)
);

create index groups_owner_id_idx on public.groups (owner_id);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  constraint group_members_pkey primary key (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members (user_id, group_id);

create table public.group_join_requests (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    constraint group_join_requests_status_check
      check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_join_requests_pkey primary key (group_id, user_id)
);

create index group_join_requests_group_status_idx
  on public.group_join_requests (group_id, status, created_at);
create index group_join_requests_user_id_idx
  on public.group_join_requests (user_id, created_at);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_join_requests enable row level security;

revoke all on table public.groups from anon, authenticated;
revoke all on table public.group_members from anon, authenticated;
revoke all on table public.group_join_requests from anon, authenticated;

grant select, delete on table public.groups to authenticated;
grant insert (name, owner_id) on table public.groups to authenticated;
grant update (name, invite_code) on table public.groups to authenticated;
grant select, delete on table public.group_members to authenticated;
grant insert (group_id, user_id) on table public.group_members to authenticated;
grant select on table public.group_join_requests to authenticated;
grant insert (group_id, user_id) on table public.group_join_requests to authenticated;
grant update (status) on table public.group_join_requests to authenticated;

grant all on table public.groups to service_role;
grant all on table public.group_members to service_role;
grant all on table public.group_join_requests to service_role;

grant usage on schema private to authenticated;

-- These helpers live outside the exposed API schema so policies can inspect
-- memberships without recursively evaluating group_members RLS.
create function private.is_group_member(target_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.group_members member
    where member.group_id = target_group_id
      and member.user_id = (select auth.uid())
  );
$$;

create function private.is_group_owner(target_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.groups owned_group
    where owned_group.id = target_group_id
      and owned_group.owner_id = (select auth.uid())
  );
$$;

create function private.can_view_group_profile(target_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1
      from public.group_members viewer
      join public.group_members target
        on target.group_id = viewer.group_id
      where viewer.user_id = (select auth.uid())
        and target.user_id = target_user_id
    )
    or exists (
      select 1
      from public.group_join_requests request
      join public.groups owned_group on owned_group.id = request.group_id
      where owned_group.owner_id = (select auth.uid())
        and request.user_id = target_user_id
    )
  );
$$;

create function private.can_read_group_leaderboard_workout(target_user_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  context_group_id uuid;
  context_value text;
begin
  if (select auth.uid()) is null then return false; end if;

  context_value := nullif(current_setting('app.group_leaderboard_id', true), '');
  if context_value is null
     or context_value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  context_group_id := context_value::uuid;

  return exists (
    select 1
    from public.group_members viewer
    join public.group_members target
      on target.group_id = viewer.group_id
    where viewer.group_id = context_group_id
      and viewer.user_id = (select auth.uid())
      and target.user_id = target_user_id
  );
end;
$$;

revoke all on function private.is_group_member(uuid) from public, anon;
revoke all on function private.is_group_owner(uuid) from public, anon;
revoke all on function private.can_view_group_profile(uuid) from public, anon;
revoke all on function private.can_read_group_leaderboard_workout(uuid) from public, anon;
grant execute on function private.is_group_member(uuid) to authenticated;
grant execute on function private.is_group_owner(uuid) to authenticated;
grant execute on function private.can_view_group_profile(uuid) to authenticated;
grant execute on function private.can_read_group_leaderboard_workout(uuid) to authenticated;

create policy "Users can create groups"
on public.groups for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "Members and invite lookup can view groups"
on public.groups for select to authenticated
using (
  owner_id = (select auth.uid())
  or (select private.is_group_member(groups.id))
  or invite_code = nullif((select current_setting('app.group_invite_code', true)), '')
);

create policy "Owners can update groups"
on public.groups for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Owners can delete groups"
on public.groups for delete to authenticated
using (owner_id = (select auth.uid()));

create policy "Members can view their group rosters"
on public.group_members for select to authenticated
using ((select private.is_group_member(group_members.group_id)));

create policy "Owners can add approved group members"
on public.group_members for insert to authenticated
with check (
  (select private.is_group_owner(group_members.group_id))
  and (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.group_join_requests request
      where request.group_id = group_members.group_id
        and request.user_id = group_members.user_id
        and request.status = 'approved'
    )
  )
);

create policy "Owners can remove group members"
on public.group_members for delete to authenticated
using (
  (select private.is_group_owner(group_members.group_id))
  and user_id <> (select auth.uid())
);

create policy "Users and owners can view group join requests"
on public.group_join_requests for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_group_owner(group_join_requests.group_id))
);

create policy "Users can request to join an invited group"
on public.group_join_requests for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1
    from public.groups invited_group
    where invited_group.id = group_join_requests.group_id
      and invited_group.invite_code =
        nullif((select current_setting('app.group_invite_code', true)), '')
  )
);

create policy "Owners can respond to group join requests"
on public.group_join_requests for update to authenticated
using (
  status = 'pending'
  and (select private.is_group_owner(group_join_requests.group_id))
)
with check (
  status in ('approved', 'declined')
  and (select private.is_group_owner(group_join_requests.group_id))
);

-- Group peers may see only the already-granted basic profile columns. The
-- authenticated role still has no table-level SELECT grant for profile email.
create policy "Group participants can view basic profiles"
on public.profiles for select to authenticated
using ((select private.can_view_group_profile(profiles.id)));

-- Raw group workout access is closed by default. It opens only inside the
-- bounded leaderboard RPC below, for the group stored in transaction-local
-- context. Existing own/friend SELECT behavior remains a separate policy.
create policy "Group leaderboard context can view workout logs"
on public.workout_logs for select to authenticated
using ((select private.can_read_group_leaderboard_workout(workout_logs.user_id)));

create function public.get_group_by_invite_code(search_invite_code text)
returns table (
  id uuid,
  name text,
  owner_id uuid,
  invite_code text,
  created_at timestamptz
)
language plpgsql
security invoker
volatile
set search_path = ''
as $$
declare
  normalized_code text := lower(trim(search_invite_code));
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if normalized_code !~ '^[a-z0-9]{10}$' then return; end if;

  perform set_config('app.group_invite_code', normalized_code, true);
  return query
    select invited_group.id, invited_group.name, invited_group.owner_id,
      invited_group.invite_code, invited_group.created_at
    from public.groups invited_group
    where invited_group.invite_code = normalized_code
    limit 1;
end;
$$;

create function public.request_to_join_group(search_invite_code text)
returns table (group_id uuid, status text)
language plpgsql
security invoker
volatile
set search_path = ''
as $$
declare
  normalized_code text := lower(trim(search_invite_code));
  invited_group_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if normalized_code !~ '^[a-z0-9]{10}$' then
    raise exception 'Invalid invite code';
  end if;

  perform set_config('app.group_invite_code', normalized_code, true);
  select invited_group.id into invited_group_id
  from public.groups invited_group
  where invited_group.invite_code = normalized_code
  limit 1;

  if invited_group_id is null then raise exception 'Group not found'; end if;
  if (select private.is_group_member(invited_group_id)) then
    raise exception 'You are already a member of this group';
  end if;

  insert into public.group_join_requests (group_id, user_id)
  values (invited_group_id, (select auth.uid()));

  return query select invited_group_id, 'pending'::text;
exception
  when unique_violation then
    return query
      select existing.group_id, existing.status
      from public.group_join_requests existing
      where existing.group_id = invited_group_id
        and existing.user_id = (select auth.uid());
end;
$$;

create function public.get_group_leaderboard_workouts(
  target_group_id uuid,
  reference_date date,
  range_start date,
  range_end date
)
returns table (
  member_id uuid,
  username text,
  display_name text,
  exercise_id uuid,
  logged_at date,
  weight_kg numeric
)
language plpgsql
security invoker
volatile
set search_path = ''
as $$
declare
  expected_week_start date;
  expected_week_end date;
  expected_month_start date;
  expected_month_end date;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not (select private.is_group_member(target_group_id)) then
    raise exception 'Group membership required';
  end if;
  if reference_date is null or abs(reference_date - current_date) > 1 then
    raise exception 'Leaderboard date is invalid';
  end if;

  expected_week_start := reference_date - (extract(isodow from reference_date)::integer - 1);
  expected_week_end := expected_week_start + 6;
  expected_month_start := date_trunc('month', reference_date)::date;
  expected_month_end := (date_trunc('month', reference_date) + interval '1 month - 1 day')::date;

  if range_start is null or range_end is null
     or range_start <> least(expected_week_start, expected_month_start)
     or range_end <> greatest(expected_week_end, expected_month_end) then
    raise exception 'Leaderboard range is invalid';
  end if;

  perform set_config('app.group_leaderboard_id', target_group_id::text, true);
  return query
    select member.user_id, profile.username, profile.display_name,
      workout.exercise_id, workout.logged_at, workout.weight_kg
    from public.group_members member
    join public.profiles profile on profile.id = member.user_id
    left join public.workout_logs workout
      on workout.user_id = member.user_id
      and workout.logged_at between range_start and range_end
    where member.group_id = target_group_id
    order by member.joined_at, workout.logged_at;
end;
$$;

revoke all on function public.get_group_by_invite_code(text) from public, anon;
revoke all on function public.request_to_join_group(text) from public, anon;
revoke all on function public.get_group_leaderboard_workouts(uuid, date, date, date)
  from public, anon;
grant execute on function public.get_group_by_invite_code(text) to authenticated;
grant execute on function public.request_to_join_group(text) to authenticated;
grant execute on function public.get_group_leaderboard_workouts(uuid, date, date, date)
  to authenticated;

create function private.add_group_owner_as_member()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id)
  values (new.id, new.owner_id);
  return new;
end;
$$;

create trigger add_group_owner_as_member_after_create
after insert on public.groups
for each row execute function private.add_group_owner_as_member();

create function private.guard_group_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'Group ownership cannot be changed';
  end if;
  new.name := trim(new.name);
  return new;
end;
$$;

create trigger guard_group_update_before_change
before update on public.groups
for each row execute function private.guard_group_update();

create function private.guard_group_join_request_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.group_id <> old.group_id or new.user_id <> old.user_id then
    raise exception 'Join request participants cannot be changed';
  end if;
  if old.status <> 'pending' or new.status not in ('approved', 'declined') then
    raise exception 'Only pending requests can be approved or declined';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_group_join_request_before_change
before update on public.group_join_requests
for each row execute function private.guard_group_join_request_update();

create function private.add_approved_group_member()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    insert into public.group_members (group_id, user_id)
    values (new.group_id, new.user_id);
  end if;
  return new;
end;
$$;

create trigger add_approved_group_member_after_response
after update on public.group_join_requests
for each row execute function private.add_approved_group_member();

revoke all on function private.add_group_owner_as_member() from public, anon, authenticated;
revoke all on function private.guard_group_update() from public, anon, authenticated;
revoke all on function private.guard_group_join_request_update() from public, anon, authenticated;
revoke all on function private.add_approved_group_member() from public, anon, authenticated;

comment on table public.groups is
  'Private squads that are independent from friendships.';
comment on table public.group_members is
  'Approved group memberships. A row is the accepted membership state.';
comment on function public.get_group_leaderboard_workouts(uuid, date, date, date) is
  'Returns only current Volume/Consistency leaderboard inputs for approved group members; never notes, sets, reps, body weight, or full workout history.';
