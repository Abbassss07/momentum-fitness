create table public.group_direct_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  group_name text not null,
  status text not null default 'pending'
    constraint group_direct_invites_status_check
      check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_direct_invites_distinct_users_check
    check (invited_user_id <> invited_by)
);

create unique index group_direct_invites_one_pending_per_user_idx
  on public.group_direct_invites (group_id, invited_user_id)
  where status = 'pending';
create index group_direct_invites_invited_user_status_idx
  on public.group_direct_invites (invited_user_id, status, created_at desc);
create index group_direct_invites_group_status_idx
  on public.group_direct_invites (group_id, status, created_at desc);
create index group_direct_invites_invited_by_idx
  on public.group_direct_invites (invited_by);

alter table public.group_direct_invites enable row level security;

revoke all on table public.group_direct_invites from anon, authenticated;
grant select, insert on table public.group_direct_invites to authenticated;
grant update (status) on table public.group_direct_invites to authenticated;
grant all on table public.group_direct_invites to service_role;

create policy "Owners and recipients can view group direct invites"
on public.group_direct_invites for select to authenticated
using (
  invited_user_id = (select auth.uid())
  or (select private.is_group_owner(group_direct_invites.group_id))
);

create policy "Owners can send direct group invites to accepted friends"
on public.group_direct_invites for insert to authenticated
with check (
  invited_by = (select auth.uid())
  and invited_user_id <> (select auth.uid())
  and (select private.is_group_owner(group_direct_invites.group_id))
  and exists (
    select 1
    from public.friendships friendship
    where friendship.status = 'accepted'
      and (
        (friendship.requester_id = (select auth.uid())
          and friendship.addressee_id = group_direct_invites.invited_user_id)
        or (friendship.addressee_id = (select auth.uid())
          and friendship.requester_id = group_direct_invites.invited_user_id)
      )
  )
  and not exists (
    select 1
    from public.group_members member
    where member.group_id = group_direct_invites.group_id
      and member.user_id = group_direct_invites.invited_user_id
  )
  and not exists (
    select 1
    from public.group_join_requests request
    where request.group_id = group_direct_invites.group_id
      and request.user_id = group_direct_invites.invited_user_id
      and request.status = 'pending'
  )
);

create policy "Recipients can respond to their direct group invites"
on public.group_direct_invites for update to authenticated
using (
  invited_user_id = (select auth.uid())
  and status = 'pending'
)
with check (
  invited_user_id = (select auth.uid())
  and status in ('accepted', 'declined')
);

create function private.guard_group_direct_invite_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.group_id <> old.group_id
     or new.invited_user_id <> old.invited_user_id
     or new.invited_by <> old.invited_by then
    raise exception 'Direct invite participants cannot be changed';
  end if;
  if new.status = old.status
     and new.group_name is distinct from old.group_name then
    return new;
  end if;
  if old.status <> 'pending' or new.status not in ('accepted', 'declined') then
    raise exception 'Only pending direct invites can be accepted or declined';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_group_direct_invite_before_change
before update on public.group_direct_invites
for each row execute function private.guard_group_direct_invite_update();

create function private.add_accepted_direct_invite_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    if (select auth.uid()) is null
       or new.invited_user_id <> (select auth.uid()) then
      raise exception 'Only the invited user can accept this direct invite';
    end if;

    insert into public.group_members (group_id, user_id)
    values (new.group_id, new.invited_user_id)
    on conflict (group_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger add_accepted_direct_invite_member_after_response
after update on public.group_direct_invites
for each row execute function private.add_accepted_direct_invite_member();

revoke all on function private.guard_group_direct_invite_update()
  from public, anon, authenticated;
revoke all on function private.add_accepted_direct_invite_member()
  from public, anon, authenticated;

create function private.set_group_direct_invite_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select owned_group.name into new.group_name
  from public.groups owned_group
  where owned_group.id = new.group_id;

  if new.group_name is null then
    raise exception 'Group not found';
  end if;
  return new;
end;
$$;

create trigger set_group_direct_invite_name_before_insert
before insert on public.group_direct_invites
for each row execute function private.set_group_direct_invite_name();

create function private.sync_group_direct_invite_names()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    update public.group_direct_invites
    set group_name = new.name
    where group_id = new.id
      and status = 'pending';
  end if;
  return new;
end;
$$;

create trigger sync_group_direct_invite_names_after_rename
after update of name on public.groups
for each row execute function private.sync_group_direct_invite_names();

revoke all on function private.set_group_direct_invite_name()
  from public, anon, authenticated;
revoke all on function private.sync_group_direct_invite_names()
  from public, anon, authenticated;

comment on table public.group_direct_invites is
  'Owner-issued invitations for accepted friends. Only the named recipient can accept and create their membership.';
