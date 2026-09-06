-- Only accounts created after this migration are eligible for the install onboarding.
-- Existing members remain ineligible, so a normal sign-in never triggers the prompt.
alter table public.profiles
  add column if not exists has_seen_install_prompt boolean not null default false,
  add column if not exists install_prompt_eligible boolean not null default false;

grant select (has_seen_install_prompt, install_prompt_eligible) on public.profiles to authenticated;
grant update (has_seen_install_prompt, install_prompt_eligible) on public.profiles to authenticated;

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

    insert into public.profiles (
      id, email, username, updated_at, install_prompt_eligible
    )
    values (
      new.id, new.email, requested_username, now(), true
    );
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
