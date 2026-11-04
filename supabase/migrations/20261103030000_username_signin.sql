-- Username sign-in without a server secret. Safe to run more than once.
-- Run after 20261103020000_lock_helpers.sql (Supabase → SQL Editor → paste → Run).
--
-- The browser calls email_for_sign_in(username, password). It returns the account's email
-- only when the password is right, so emails can't be fished out by username, then the app
-- signs in with that email as usual. Wrong tries are counted: 10 in 15 minutes for one
-- username blocks that username for a while (email sign-in still works).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.sign_in_attempts (
  username text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists sign_in_attempts_lookup on public.sign_in_attempts (username, attempted_at);

-- Nobody reads this through the API: RLS on and no policies.
alter table public.sign_in_attempts enable row level security;
revoke all on public.sign_in_attempts from public, anon, authenticated;

create or replace function public.email_for_sign_in(name text, password text)
returns text
language plpgsql
volatile
security definer set search_path = ''
as $$
declare
  uname text := lower(trim(coalesce(name, '')));
  found_email text;
  hash text;
begin
  if uname = '' or coalesce(password, '') = '' then
    return null;
  end if;

  if (select count(*) from public.sign_in_attempts
      where username = uname and attempted_at > now() - interval '15 minutes') >= 10 then
    raise exception 'Too many attempts. Wait 15 minutes, or sign in with your email.' using errcode = 'P0001';
  end if;

  select u.email, u.encrypted_password into found_email, hash
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.username = uname;

  if hash is not null and hash = extensions.crypt(password, hash) then
    delete from public.sign_in_attempts where username = uname;
    return found_email;
  end if;

  -- Unknown usernames take as long as wrong passwords, so names can't be probed by timing.
  if hash is null then
    perform extensions.crypt(password, extensions.gen_salt('bf', 10));
  end if;

  insert into public.sign_in_attempts (username) values (uname);
  delete from public.sign_in_attempts where attempted_at < now() - interval '1 day';
  return null;
end;
$$;

revoke execute on function public.email_for_sign_in(text, text) from public;
grant execute on function public.email_for_sign_in(text, text) to anon, authenticated;

-- The old server-only lookup (needed the service-role key) is no longer used.
drop function if exists public.email_for_username(text);
