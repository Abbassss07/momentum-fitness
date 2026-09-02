drop policy "Users can find and view connected profiles" on public.profiles;
drop policy "Group participants can view basic profiles" on public.profiles;

create policy "Users can find and view connected profiles"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or lower(username) = lower(
    nullif((select current_setting('app.search_username', true)), '')
  )
  or exists (
    select 1
    from public.friendships friendship
    where
      (friendship.requester_id = (select auth.uid())
        and friendship.addressee_id = profiles.id)
      or (friendship.addressee_id = (select auth.uid())
        and friendship.requester_id = profiles.id)
  )
  or (select private.can_view_group_profile(profiles.id))
);

drop policy "Users and friends can view workout logs" on public.workout_logs;
drop policy "Group leaderboard context can view workout logs" on public.workout_logs;

create policy "Users and friends can view workout logs"
on public.workout_logs for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.friendships friendship
    where friendship.status = 'accepted'
      and (
        (friendship.requester_id = (select auth.uid())
          and friendship.addressee_id = workout_logs.user_id)
        or (friendship.addressee_id = (select auth.uid())
          and friendship.requester_id = workout_logs.user_id)
      )
  )
  or (select private.can_read_group_leaderboard_workout(workout_logs.user_id))
);
