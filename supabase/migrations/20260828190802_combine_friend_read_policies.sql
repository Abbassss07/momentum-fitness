drop policy "Users can view own body weight" on public.body_weight_logs;
drop policy "Friends can view body weight logs" on public.body_weight_logs;
create policy "Users and friends can view body weight logs"
on public.body_weight_logs for select to authenticated
using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.friendships f
    where f.status = 'accepted' and (
      (f.requester_id = (select auth.uid()) and f.addressee_id = body_weight_logs.user_id)
      or (f.addressee_id = (select auth.uid()) and f.requester_id = body_weight_logs.user_id)
    )
  )
);

drop policy "Users can view own workout logs" on public.workout_logs;
drop policy "Friends can view workout logs" on public.workout_logs;
create policy "Users and friends can view workout logs"
on public.workout_logs for select to authenticated
using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.friendships f
    where f.status = 'accepted' and (
      (f.requester_id = (select auth.uid()) and f.addressee_id = workout_logs.user_id)
      or (f.addressee_id = (select auth.uid()) and f.requester_id = workout_logs.user_id)
    )
  )
);

drop policy "Users can view their legacy workouts" on public.workouts;
drop policy "Friends can view legacy workouts" on public.workouts;
create policy "Users and friends can view legacy workouts"
on public.workouts for select to authenticated
using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.friendships f
    where f.status = 'accepted' and (
      (f.requester_id = (select auth.uid()) and f.addressee_id = workouts.user_id)
      or (f.addressee_id = (select auth.uid()) and f.requester_id = workouts.user_id)
    )
  )
);
