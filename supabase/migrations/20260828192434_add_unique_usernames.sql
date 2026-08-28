alter table public.profiles add column username text;

update public.profiles p
set username =
  left(
    case
      when regexp_replace(lower(split_part(p.email, '@', 1)), '[^a-z0-9_]', '', 'g') ~ '^[a-z][a-z0-9_]{2,23}$'
        then regexp_replace(lower(split_part(p.email, '@', 1)), '[^a-z0-9_]', '', 'g')
      else 'user'
    end,
    16
  ) || '_' || left(replace(p.id::text, '-', ''), 6);

alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_format_check
    check (username = lower(username) and username ~ '^[a-z][a-z0-9_]{2,23}$'),
  add constraint profiles_username_key unique (username);

create or replace function public.sync_auth_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  requested_username text;
begin
  if new.email is null then return new; end if;

  if tg_op = 'INSERT' then
    requested_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
    if requested_username !~ '^[a-z][a-z0-9_]{2,23}$' then
      raise exception using
        errcode = 'check_violation',
        message = 'Username must be 3-24 characters and use lowercase letters, numbers, or underscores.';
    end if;
    insert into public.profiles (id, email, username, updated_at)
    values (new.id, new.email, requested_username, now());
  else
    insert into public.profiles (id, email, username, updated_at)
    values (new.id, new.email, 'user_' || left(replace(new.id::text, '-', ''), 8), now())
    on conflict (id) do update set email = excluded.email, updated_at = now();
  end if;
  return new;
exception
  when unique_violation then
    raise exception using errcode = 'unique_violation', message = 'That username is already taken.';
end;
$$;

drop policy "Users can find and view connected profiles" on public.profiles;
create policy "Users can find and view connected profiles"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or lower(username) = lower(nullif((select current_setting('app.search_username', true)), ''))
  or exists (
    select 1 from public.friendships f
    where (f.requester_id = (select auth.uid()) and f.addressee_id = profiles.id)
       or (f.addressee_id = (select auth.uid()) and f.requester_id = profiles.id)
  )
);

create policy "Visitors can check an exact username"
on public.profiles for select to anon
using (lower(username) = lower(nullif((select current_setting('app.search_username', true)), '')));

revoke select on public.profiles from anon, authenticated;
grant select (id, username) on public.profiles to anon, authenticated;

drop function public.find_profile_by_email(text);

create function public.find_profile_by_username(search_username text)
returns table (id uuid, username text)
language plpgsql security invoker volatile set search_path = '' as $$
declare
  normalized text := lower(trim(search_username));
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if normalized !~ '^[a-z][a-z0-9_]{2,23}$' then return; end if;
  perform set_config('app.search_username', normalized, true);
  return query
    select p.id, p.username from public.profiles p
    where p.username = normalized and p.id <> (select auth.uid()) limit 1;
end;
$$;

create function public.is_username_available(candidate text)
returns boolean
language plpgsql security invoker volatile set search_path = '' as $$
declare
  normalized text := lower(trim(candidate));
begin
  if normalized !~ '^[a-z][a-z0-9_]{2,23}$' then return false; end if;
  perform set_config('app.search_username', normalized, true);
  return not exists (select 1 from public.profiles p where p.username = normalized);
end;
$$;

revoke all on function public.find_profile_by_username(text) from public, anon;
grant execute on function public.find_profile_by_username(text) to authenticated;
revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;
