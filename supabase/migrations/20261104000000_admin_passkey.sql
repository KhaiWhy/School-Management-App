-- Admin page with a passkey (not tied to anyone's account) + teacher invite codes.
-- Safe to run more than once. Run after 20261103030000_username_signin.sql.
--
-- The passkey itself is never stored: only a salted SHA-256 hash, written by
-- `npm run admin:set-passkey` (which hashes it on your computer). Wrong passkeys are
-- counted: 10 in 15 minutes locks the admin page for a while.
--
-- Every admin_* function takes the passkey and checks it first. They never raise on a
-- wrong passkey (so the wrong try is still counted): mutations return a status word and
-- lists return no rows. The page calls admin_status() first to say what went wrong.

create extension if not exists pgcrypto with schema extensions;

-- ---------- Private tables (RLS on, no policies, no grants: unreadable through the API) ----------

create table if not exists public.admin_settings (
  id smallint primary key default 1 check (id = 1),
  passkey_salt text not null,
  passkey_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_attempts (
  attempted_at timestamptz not null default now()
);

create table if not exists public.teacher_invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  code_hint text not null,
  note text not null default '' check (length(note) <= 120),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz
);

alter table public.admin_settings enable row level security;
alter table public.admin_attempts enable row level security;
alter table public.teacher_invites enable row level security;
revoke all on public.admin_settings, public.admin_attempts, public.teacher_invites from public, anon, authenticated;

-- ---------- Passkey check ----------

create or replace function public.admin_check(passkey text)
returns text
language plpgsql
volatile
security definer set search_path = ''
as $$
declare
  s public.admin_settings;
begin
  if (select count(*) from public.admin_attempts where attempted_at > now() - interval '15 minutes') >= 10 then
    return 'locked';
  end if;
  select * into s from public.admin_settings where id = 1;
  if s.id is null then
    return 'unset';
  end if;
  if coalesce(passkey, '') = ''
     or encode(extensions.digest(s.passkey_salt || passkey, 'sha256'), 'hex') <> s.passkey_hash then
    insert into public.admin_attempts default values;
    delete from public.admin_attempts where attempted_at < now() - interval '1 day';
    return 'wrong';
  end if;
  -- Lets this transaction change roles past the protect_role trigger.
  perform set_config('schooling.admin_action', 'on', true);
  return 'ok';
end;
$$;

-- 'ok' | 'wrong' | 'locked' | 'unset'
create or replace function public.admin_status(passkey text)
returns text
language sql volatile security definer set search_path = ''
as $$ select public.admin_check(passkey) $$;

-- Roles: the admin page may change them; nobody else can (except the SQL Editor).
create or replace function public.protect_role()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin()
     and coalesce(current_setting('schooling.admin_action', true), '') <> 'on' then
    raise exception 'Only an admin can change roles';
  end if;
  new.id := old.id;
  new.username := lower(trim(new.username));
  return new;
end;
$$;

-- ---------- People ----------

create or replace function public.admin_people(passkey text, search text default '')
returns table (id uuid, full_name text, username text, email text, role text, created_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  term text := '%' || lower(trim(coalesce(search, ''))) || '%';
begin
  if public.admin_check(passkey) <> 'ok' then
    return;
  end if;
  return query
    select p.id, p.full_name, p.username, u.email::text, p.role, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(p.full_name) like term or p.username like term or lower(u.email) like term
    order by p.role desc, p.full_name
    limit 500;
end;
$$;

create or replace function public.admin_set_role(passkey text, target uuid, new_role text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  status text := public.admin_check(passkey);
begin
  if status <> 'ok' then
    return status;
  end if;
  if new_role not in ('student', 'teacher') then
    return 'bad-role';
  end if;
  update public.profiles set role = new_role where profiles.id = target;
  return case when found then 'ok' else 'not-found' end;
end;
$$;

-- ---------- Teacher invite codes ----------

-- "ABCD-EFGH-JKMN" style: 12 characters, no look-alikes (0/O, 1/I/L).
create or replace function public.new_invite_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(12);
  code text := '';
begin
  for i in 0..11 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return substr(code, 1, 4) || '-' || substr(code, 5, 4) || '-' || substr(code, 9, 4);
end;
$$;

create or replace function public.invite_hash(code text)
returns text
language sql immutable set search_path = ''
as $$ select encode(extensions.digest(upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex') $$;

-- Returns {"status": "ok", "code": "..."}; the code is shown once and only its hash is kept.
create or replace function public.admin_create_invite(passkey text, note text default '', days int default 7)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  status text := public.admin_check(passkey);
  code text;
begin
  if status <> 'ok' then
    return jsonb_build_object('status', status);
  end if;
  code := public.new_invite_code();
  insert into public.teacher_invites (code_hash, code_hint, note, expires_at)
  values (public.invite_hash(code), right(code, 4), left(coalesce(note, ''), 120),
          now() + make_interval(days => greatest(1, least(coalesce(days, 7), 30))));
  return jsonb_build_object('status', 'ok', 'code', code);
end;
$$;

create or replace function public.admin_invites(passkey text)
returns table (id uuid, code_hint text, note text, created_at timestamptz, expires_at timestamptz,
               used_by_name text, used_at timestamptz, revoked_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if public.admin_check(passkey) <> 'ok' then
    return;
  end if;
  return query
    select i.id, i.code_hint, i.note, i.created_at, i.expires_at, p.full_name, i.used_at, i.revoked_at
    from public.teacher_invites i
    left join public.profiles p on p.id = i.used_by
    order by i.created_at desc
    limit 200;
end;
$$;

create or replace function public.admin_revoke_invite(passkey text, invite uuid)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  status text := public.admin_check(passkey);
begin
  if status <> 'ok' then
    return status;
  end if;
  update public.teacher_invites set revoked_at = now()
  where teacher_invites.id = invite and used_at is null and revoked_at is null;
  return case when found then 'ok' else 'not-found' end;
end;
$$;

-- Sign-up form check, so a typo gets a clear message before the account is made.
create or replace function public.check_teacher_code(code text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.teacher_invites
    where code_hash = public.invite_hash(code)
      and used_at is null and revoked_at is null and expires_at > now()
  )
$$;

-- New accounts: student, or teacher with a valid unused invite code (the code is then used up).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  code text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'teacher_code', '')), '');
  invite uuid;
begin
  if code is not null then
    select id into invite from public.teacher_invites
    where code_hash = public.invite_hash(code)
      and used_at is null and revoked_at is null and expires_at > now()
    for update;
    if invite is null then
      raise exception 'TEACHER_CODE_INVALID';
    end if;
  end if;

  insert into public.profiles (id, full_name, username, role)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    public.username_from_email(new.email),
    case when invite is null then 'student' else 'teacher' end
  );

  if invite is not null then
    update public.teacher_invites set used_by = new.id, used_at = now() where id = invite;
  end if;
  return new;
end;
$$;

-- ---------- Classes ----------

create or replace function public.admin_classes(passkey text)
returns table (id uuid, name text, subject text, teacher_name text, join_code text, students bigint, created_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if public.admin_check(passkey) <> 'ok' then
    return;
  end if;
  return query
    select c.id, c.name, c.subject, p.full_name, c.join_code,
           (select count(*) from public.class_members m where m.class_id = c.id), c.created_at
    from public.classes c
    join public.profiles p on p.id = c.teacher_id
    order by c.name;
end;
$$;

create or replace function public.admin_class_members(passkey text, class uuid)
returns table (id uuid, full_name text, username text)
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if public.admin_check(passkey) <> 'ok' then
    return;
  end if;
  return query
    select p.id, p.full_name, p.username
    from public.class_members m join public.profiles p on p.id = m.user_id
    where m.class_id = class
    order by p.full_name;
end;
$$;

create or replace function public.admin_remove_member(passkey text, class uuid, member uuid)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  status text := public.admin_check(passkey);
begin
  if status <> 'ok' then
    return status;
  end if;
  delete from public.class_members where class_id = class and user_id = member;
  return case when found then 'ok' else 'not-found' end;
end;
$$;

-- ---------- Who may call what ----------

revoke execute on function public.admin_check(text) from public, anon, authenticated;
revoke execute on function public.new_invite_code() from public, anon, authenticated;
revoke execute on function public.invite_hash(text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_role() from public, anon, authenticated;

revoke execute on function public.admin_status(text) from public;
revoke execute on function public.admin_people(text, text) from public;
revoke execute on function public.admin_set_role(text, uuid, text) from public;
revoke execute on function public.admin_create_invite(text, text, int) from public;
revoke execute on function public.admin_invites(text) from public;
revoke execute on function public.admin_revoke_invite(text, uuid) from public;
revoke execute on function public.admin_classes(text) from public;
revoke execute on function public.admin_class_members(text, uuid) from public;
revoke execute on function public.admin_remove_member(text, uuid, uuid) from public;
revoke execute on function public.check_teacher_code(text) from public;

grant execute on function public.admin_status(text) to anon, authenticated;
grant execute on function public.admin_people(text, text) to anon, authenticated;
grant execute on function public.admin_set_role(text, uuid, text) to anon, authenticated;
grant execute on function public.admin_create_invite(text, text, int) to anon, authenticated;
grant execute on function public.admin_invites(text) to anon, authenticated;
grant execute on function public.admin_revoke_invite(text, uuid) to anon, authenticated;
grant execute on function public.admin_classes(text) to anon, authenticated;
grant execute on function public.admin_class_members(text, uuid) to anon, authenticated;
grant execute on function public.admin_remove_member(text, uuid, uuid) to anon, authenticated;
grant execute on function public.check_teacher_code(text) to anon, authenticated;
