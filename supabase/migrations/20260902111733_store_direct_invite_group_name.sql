alter table public.group_direct_invites
  add column group_name text;

update public.group_direct_invites invite
set group_name = direct_group.name
from public.groups direct_group
where direct_group.id = invite.group_id;

alter table public.group_direct_invites
  alter column group_name set not null;

drop function public.get_my_group_direct_invites();

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
