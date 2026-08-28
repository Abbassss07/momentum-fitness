drop policy "Users can view connected profiles" on public.profiles;

create policy "Users can find and view connected profiles"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or lower(email) = lower(nullif(current_setting('app.search_email', true), ''))
  or exists (
    select 1 from public.friendships f
    where (f.requester_id = (select auth.uid()) and f.addressee_id = profiles.id)
       or (f.addressee_id = (select auth.uid()) and f.requester_id = profiles.id)
  )
);

create or replace function public.find_profile_by_email(search_email text)
returns table (id uuid, email text)
language plpgsql
security invoker
volatile
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if char_length(trim(search_email)) < 5 then
    return;
  end if;

  perform set_config('app.search_email', lower(trim(search_email)), true);

  return query
    select p.id, p.email
    from public.profiles p
    where lower(p.email) = lower(trim(search_email))
      and p.id <> (select auth.uid())
    limit 1;
end;
$$;
