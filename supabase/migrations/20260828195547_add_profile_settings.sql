alter table public.profiles
  add column display_name text,
  add constraint profiles_display_name_length_check
    check (
      display_name is null
      or char_length(trim(display_name)) between 1 and 80
    );

grant select (display_name) on public.profiles to authenticated;
grant update (username, display_name) on public.profiles to authenticated;

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create function public.touch_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_profile_updated_at() from public, anon, authenticated;

create trigger touch_profile_updated_at_before_change
before update on public.profiles
for each row execute function public.touch_profile_updated_at();
