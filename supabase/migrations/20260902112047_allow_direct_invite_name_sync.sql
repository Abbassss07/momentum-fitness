create or replace function private.guard_group_direct_invite_update()
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

revoke all on function private.guard_group_direct_invite_update()
  from public, anon, authenticated;
