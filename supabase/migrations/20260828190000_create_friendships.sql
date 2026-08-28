create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id),
  addressee_id uuid not null references auth.users(id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_no_self_friendship
    check (requester_id <> addressee_id)
);

-- A functional unique index makes (A, B) and (B, A) the same friendship pair.
create unique index friendships_unique_pair_idx
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

-- These indexes support the accepted-friend lookup used by the RLS policies.
create index friendships_accepted_requester_idx
  on public.friendships (requester_id)
  where status = 'accepted';

create index friendships_accepted_addressee_idx
  on public.friendships (addressee_id)
  where status = 'accepted';

create function public.set_friendships_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger friendships_set_updated_at
before update on public.friendships
for each row
execute function public.set_friendships_updated_at();

alter table public.friendships enable row level security;

-- Grant only the operations exposed to signed-in users. RLS below scopes rows.
revoke all on table public.friendships from anon;
revoke all on table public.friendships from authenticated;
grant select, insert, delete on table public.friendships to authenticated;
grant update (status) on table public.friendships to authenticated;

create policy "Users can view their friendships"
on public.friendships
for select
to authenticated
using (
  (select auth.uid()) = requester_id
  or (select auth.uid()) = addressee_id
);

create policy "Users can send friendship requests"
on public.friendships
for insert
to authenticated
with check ((select auth.uid()) = requester_id);

create policy "Addressees can respond to friendship requests"
on public.friendships
for update
to authenticated
using ((select auth.uid()) = addressee_id)
with check (
  (select auth.uid()) = addressee_id
  and status in ('accepted', 'declined')
);

create policy "Users can remove their friendships"
on public.friendships
for delete
to authenticated
using (
  (select auth.uid()) = requester_id
  or (select auth.uid()) = addressee_id
);

-- Existing owner SELECT policies remain in place. This adds an OR'd, read-only
-- route for an accepted friend and does not create any write policy for friends.
create policy "Accepted friends can view workout logs"
on public.workout_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.friendships
    where status = 'accepted'
      and (
        (requester_id = workout_logs.user_id and addressee_id = (select auth.uid()))
        or (addressee_id = workout_logs.user_id and requester_id = (select auth.uid()))
      )
  )
);

create policy "Accepted friends can view body weight logs"
on public.body_weight_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.friendships
    where status = 'accepted'
      and (
        (requester_id = body_weight_logs.user_id and addressee_id = (select auth.uid()))
        or (addressee_id = body_weight_logs.user_id and requester_id = (select auth.uid()))
      )
  )
);
