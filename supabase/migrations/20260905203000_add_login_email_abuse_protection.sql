-- Server-only audit tables for protecting sign-in email delivery. Email addresses
-- are hashed by the API route before reaching Postgres.
create schema if not exists private;

create table private.login_rate_limit_attempts (
  id bigint generated always as identity primary key,
  ip inet not null,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index login_rate_limit_attempts_ip_created_at_idx
  on private.login_rate_limit_attempts (ip, created_at desc);

create index login_rate_limit_attempts_email_hash_created_at_idx
  on private.login_rate_limit_attempts (email_hash, created_at desc);

create table private.banned_ips (
  ip inet primary key,
  reason text not null check (char_length(reason) between 1 and 160),
  banned_at timestamptz not null default now(),
  expires_at timestamptz,
  check (expires_at is null or expires_at > banned_at)
);

create table private.login_ip_ban_events (
  id bigint generated always as identity primary key,
  ip inet not null,
  reason text not null check (char_length(reason) between 1 and 160),
  banned_at timestamptz not null default now(),
  expires_at timestamptz
);

create index login_ip_ban_events_ip_banned_at_idx
  on private.login_ip_ban_events (ip, banned_at desc);

alter table private.login_rate_limit_attempts enable row level security;
alter table private.banned_ips enable row level security;
alter table private.login_ip_ban_events enable row level security;

create policy "Service role manages login attempts"
on private.login_rate_limit_attempts for all
to service_role
using (true)
with check (true);

create policy "Service role manages banned IPs"
on private.banned_ips for all
to service_role
using (true)
with check (true);

create policy "Service role manages login ban events"
on private.login_ip_ban_events for all
to service_role
using (true)
with check (true);

revoke all on table private.login_rate_limit_attempts, private.banned_ips, private.login_ip_ban_events
  from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert on private.login_rate_limit_attempts to service_role;
grant select, insert, update on private.banned_ips to service_role;
grant select, insert on private.login_ip_ban_events to service_role;
grant usage, select on all sequences in schema private to service_role;

create or replace function public.consume_login_email_rate_limit(
  target_ip inet,
  target_email_hash text,
  ip_max_requests integer,
  ip_window_seconds integer,
  email_max_requests integer,
  email_window_seconds integer,
  ban_threshold integer,
  ban_window_seconds integer,
  ban_duration_seconds integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  ip_request_count integer;
  email_request_count integer;
  ban_request_count integer;
  ip_retry_after integer := 0;
  email_retry_after integer := 0;
  active_ban record;
begin
  if target_ip is null
    or target_email_hash !~ '^[0-9a-f]{64}$'
    or ip_max_requests not between 1 and 100
    or email_max_requests not between 1 and 100
    or ban_threshold not between 2 and 1000
    or ip_window_seconds not between 60 and 86400
    or email_window_seconds not between 60 and 86400
    or ban_window_seconds not between 60 and 86400
    or ban_duration_seconds not between 300 and 604800 then
    raise exception 'Invalid login email rate limit configuration';
  end if;

  -- Serialize overlapping IP/email windows so simultaneous requests cannot all
  -- observe the same pre-insert count and bypass a limit.
  perform pg_advisory_xact_lock(hashtext('login-email-ip:' || target_ip::text));
  perform pg_advisory_xact_lock(hashtext('login-email-address:' || target_email_hash));

  select expires_at
  into active_ban
  from private.banned_ips
  where ip = target_ip
    and (expires_at is null or expires_at > now());

  if found then
    return jsonb_build_object(
      'allowed', false,
      'state', 'banned',
      'retryAfterSeconds', case
        when active_ban.expires_at is null then ban_duration_seconds
        else greatest(1, ceil(extract(epoch from active_ban.expires_at - now()))::integer)
      end
    );
  end if;

  insert into private.login_rate_limit_attempts (ip, email_hash)
  values (target_ip, target_email_hash);

  select count(*)::integer
  into ban_request_count
  from private.login_rate_limit_attempts
  where ip = target_ip
    and created_at >= now() - (ban_window_seconds * interval '1 second');

  if ban_request_count > ban_threshold then
    insert into private.banned_ips (ip, reason, banned_at, expires_at)
    values (
      target_ip,
      'Exceeded login email abuse threshold',
      now(),
      now() + (ban_duration_seconds * interval '1 second')
    )
    on conflict (ip) do update
      set reason = excluded.reason,
          banned_at = excluded.banned_at,
          expires_at = excluded.expires_at;

    insert into private.login_ip_ban_events (ip, reason, banned_at, expires_at)
    values (
      target_ip,
      'Exceeded login email abuse threshold',
      now(),
      now() + (ban_duration_seconds * interval '1 second')
    );

    return jsonb_build_object(
      'allowed', false,
      'state', 'banned',
      'retryAfterSeconds', ban_duration_seconds
    );
  end if;

  select count(*)::integer
  into ip_request_count
  from private.login_rate_limit_attempts
  where ip = target_ip
    and created_at >= now() - (ip_window_seconds * interval '1 second');

  select count(*)::integer
  into email_request_count
  from private.login_rate_limit_attempts
  where email_hash = target_email_hash
    and created_at >= now() - (email_window_seconds * interval '1 second');

  if ip_request_count > ip_max_requests then
    select greatest(
      1,
      ceil(extract(epoch from (
        min(created_at) + (ip_window_seconds * interval '1 second') - now()
      ))::integer
    )
    into ip_retry_after
    from private.login_rate_limit_attempts
    where ip = target_ip
      and created_at >= now() - (ip_window_seconds * interval '1 second');
  end if;

  if email_request_count > email_max_requests then
    select greatest(
      1,
      ceil(extract(epoch from (
        min(created_at) + (email_window_seconds * interval '1 second') - now()
      ))::integer
    )
    into email_retry_after
    from private.login_rate_limit_attempts
    where email_hash = target_email_hash
      and created_at >= now() - (email_window_seconds * interval '1 second');
  end if;

  if ip_request_count > ip_max_requests or email_request_count > email_max_requests then
    return jsonb_build_object(
      'allowed', false,
      'state', 'rate_limited',
      'retryAfterSeconds', greatest(1, ip_retry_after, email_retry_after)
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'state', 'allowed',
    'retryAfterSeconds', 0
  );
end;
$function$;

revoke all on function public.consume_login_email_rate_limit(
  inet, text, integer, integer, integer, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.consume_login_email_rate_limit(
  inet, text, integer, integer, integer, integer, integer, integer, integer
) to service_role;

create or replace function private.cleanup_login_email_abuse_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  delete from private.login_rate_limit_attempts
  where created_at < now() - interval '48 hours';

  delete from private.banned_ips
  where expires_at is not null and expires_at <= now();

  delete from private.login_ip_ban_events
  where banned_at < now() - interval '90 days';
end;
$function$;

revoke all on function private.cleanup_login_email_abuse_data() from public, anon, authenticated;

select cron.schedule(
  'cleanup-login-email-abuse-data',
  '17 3 * * *',
  'select private.cleanup_login_email_abuse_data();'
);

