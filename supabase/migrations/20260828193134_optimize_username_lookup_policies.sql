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

drop policy "Visitors can check an exact username" on public.profiles;
create policy "Visitors can check an exact username"
on public.profiles for select to anon
using (
  lower(username) = lower(nullif((select current_setting('app.search_username', true)), ''))
);
