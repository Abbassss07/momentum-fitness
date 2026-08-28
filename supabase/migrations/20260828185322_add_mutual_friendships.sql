create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_not_blank check (char_length(trim(email)) > 3)
);

create unique index profiles_email_lower_key on public.profiles (lower(email));

insert into public.profiles (id, email)
select id, email from auth.users where email is not null
on conflict (id) do update set email = excluded.email, updated_at = now();

alter table public.profiles enable row level security;

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    constraint friendships_status_check check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_distinct_users check (requester_id <> addressee_id)
);

create unique index friendships_unique_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_requester_status_idx on public.friendships (requester_id, status);
create index friendships_addressee_status_idx on public.friendships (addressee_id, status);

alter table public.friendships enable row level security;

create policy "Users can view their friendships" on public.friendships
for select to authenticated
using ((select auth.uid()) = requester_id or (select auth.uid()) = addressee_id);

create policy "Users can send friend requests" on public.friendships
for insert to authenticated
with check ((select auth.uid()) = requester_id and requester_id <> addressee_id and status = 'pending');

create policy "Addressees can respond to friend requests" on public.friendships
for update to authenticated
using ((select auth.uid()) = addressee_id and status = 'pending')
with check ((select auth.uid()) = addressee_id and status in ('accepted', 'declined'));

create policy "Users can remove their friendships" on public.friendships
for delete to authenticated
using ((select auth.uid()) = requester_id or (select auth.uid()) = addressee_id);

create policy "Users can view connected profiles" on public.profiles
for select to authenticated
using (
  id = (select auth.uid()) or exists (
    select 1 from public.friendships f
    where (f.requester_id = (select auth.uid()) and f.addressee_id = profiles.id)
       or (f.addressee_id = (select auth.uid()) and f.requester_id = profiles.id)
  )
);

create policy "Friends can view workout logs" on public.workout_logs
for select to authenticated
using (exists (
  select 1 from public.friendships f
  where f.status = 'accepted' and (
    (f.requester_id = (select auth.uid()) and f.addressee_id = workout_logs.user_id)
    or (f.addressee_id = (select auth.uid()) and f.requester_id = workout_logs.user_id)
  )
));

create policy "Friends can view body weight logs" on public.body_weight_logs
for select to authenticated
using (exists (
  select 1 from public.friendships f
  where f.status = 'accepted' and (
    (f.requester_id = (select auth.uid()) and f.addressee_id = body_weight_logs.user_id)
    or (f.addressee_id = (select auth.uid()) and f.requester_id = body_weight_logs.user_id)
  )
));

create policy "Friends can view legacy workouts" on public.workouts
for select to authenticated
using (exists (
  select 1 from public.friendships f
  where f.status = 'accepted' and (
    (f.requester_id = (select auth.uid()) and f.addressee_id = workouts.user_id)
    or (f.addressee_id = (select auth.uid()) and f.requester_id = workouts.user_id)
  )
));

create or replace function public.sync_auth_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null then
    insert into public.profiles (id, email, updated_at) values (new.id, new.email, now())
    on conflict (id) do update set email = excluded.email, updated_at = now();
  end if;
  return new;
end;
$$;

revoke all on function public.sync_auth_user_profile() from public, anon, authenticated;
create trigger sync_auth_user_profile_after_change
after insert or update of email on auth.users
for each row execute function public.sync_auth_user_profile();

create or replace function public.find_profile_by_email(search_email text)
returns table (id uuid, email text)
language plpgsql security definer stable set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if char_length(trim(search_email)) < 5 then return; end if;
  return query
    select p.id, p.email from public.profiles p
    where lower(p.email) = lower(trim(search_email)) and p.id <> (select auth.uid())
    limit 1;
end;
$$;

revoke all on function public.find_profile_by_email(text) from public, anon;
grant execute on function public.find_profile_by_email(text) to authenticated;

create or replace function public.guard_friendship_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'Friendship participants cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.guard_friendship_update() from public, anon, authenticated;
create trigger guard_friendship_update_before_change
before update on public.friendships
for each row execute function public.guard_friendship_update();

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
