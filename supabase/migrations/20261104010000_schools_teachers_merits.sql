-- Phase 1 additions. Safe to run more than once. Run after 20261104000000_admin_passkey.sql.
--   * Schools (name only): students pick theirs at sign-up; the admin adds them.
--   * Teacher accounts are made on the admin page (name, email, school). The page adds the
--     email to teacher_emails, then creates the account; the database sees the email and
--     makes it a teacher. Sign-up on the site is for students.
--   * Merits and demerits: teachers give them to students in their classes; students see theirs.
--   * The teacher invite codes from the previous migration are removed.

-- ---------- Schools ----------

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);

create unique index if not exists schools_name_unique on public.schools (lower(trim(name)));

alter table public.schools enable row level security;
revoke all on public.schools from public, anon, authenticated;
grant select on public.schools to anon, authenticated;

drop policy if exists "schools: anyone reads names" on public.schools;
create policy "schools: anyone reads names" on public.schools
  for select to anon, authenticated using (true);

alter table public.profiles add column if not exists school_id uuid references public.schools (id) on delete set null;

-- ---------- Teacher accounts (made by the admin) ----------

create table if not exists public.teacher_emails (
  email text primary key check (email = lower(trim(email))),
  full_name text not null default '' check (length(full_name) <= 120),
  school_id uuid references public.schools (id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table public.teacher_emails enable row level security;
revoke all on public.teacher_emails from public, anon, authenticated;

-- New accounts: a teacher if the admin added this email, otherwise a student.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  t public.teacher_emails;
  school uuid := public.try_uuid(new.raw_user_meta_data ->> 'school_id');
begin
  select * into t from public.teacher_emails where email = lower(new.email) and used_at is null for update;
  if school is not null and not exists (select 1 from public.schools where id = school) then
    school := null;
  end if;

  insert into public.profiles (id, full_name, username, role, school_id)
  values (
    new.id,
    left(coalesce(nullif(t.full_name, ''), new.raw_user_meta_data ->> 'full_name', ''), 120),
    public.username_from_email(new.email),
    case when t.email is null then 'student' else 'teacher' end,
    case when t.email is null then school else t.school_id end
  );

  if t.email is not null then
    update public.teacher_emails set used_at = now() where email = t.email;
  end if;
  return new;
end;
$$;

-- ---------- Remove the invite codes ----------

drop function if exists public.admin_create_invite(text, text, int);
drop function if exists public.admin_invites(text);
drop function if exists public.admin_revoke_invite(text, uuid);
drop function if exists public.check_teacher_code(text);
drop function if exists public.new_invite_code();
drop function if exists public.invite_hash(text);
drop table if exists public.teacher_invites;

-- ---------- Admin: schools ----------

create or replace function public.admin_schools(passkey text)
returns table (id uuid, name text, students bigint, teachers bigint, created_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if public.admin_check(passkey) <> 'ok' then
    return;
  end if;
  return query
    select s.id, s.name,
           (select count(*) from public.profiles p where p.school_id = s.id and p.role = 'student'),
           (select count(*) from public.profiles p where p.school_id = s.id and p.role = 'teacher'),
           s.created_at
    from public.schools s
    order by s.name;
end;
$$;

create or replace function public.admin_save_school(passkey text, school uuid, school_name text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  status text := public.admin_check(passkey);
  clean text := trim(coalesce(school_name, ''));
begin
  if status <> 'ok' then
    return status;
  end if;
  if length(clean) < 2 or length(clean) > 120 then
    return 'bad-name';
  end if;
  if exists (select 1 from public.schools where lower(trim(name)) = lower(clean) and id is distinct from school) then
    return 'duplicate';
  end if;
  if school is null then
    insert into public.schools (name) values (clean);
  else
    update public.schools set name = clean where schools.id = school;
    if not found then
      return 'not-found';
    end if;
  end if;
  return 'ok';
end;
$$;

create or replace function public.admin_delete_school(passkey text, school uuid)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  status text := public.admin_check(passkey);
begin
  if status <> 'ok' then
    return status;
  end if;
  delete from public.schools where schools.id = school;
  return case when found then 'ok' else 'not-found' end;
end;
$$;

-- ---------- Admin: teachers ----------

-- Step 1 of making a teacher account. 'ok' = now create the account with this email;
-- 'existing' = that email already has an account, which is now a teacher (nothing else to do).
create or replace function public.admin_prepare_teacher(passkey text, teacher_email text, teacher_name text, school uuid)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  status text := public.admin_check(passkey);
  clean text := lower(trim(coalesce(teacher_email, '')));
  existing uuid;
begin
  if status <> 'ok' then
    return status;
  end if;
  if clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return 'bad-email';
  end if;
  if school is not null and not exists (select 1 from public.schools where id = school) then
    return 'not-found';
  end if;
  select id into existing from auth.users where lower(email) = clean;
  if existing is not null then
    update public.profiles
    set role = 'teacher', school_id = coalesce(school, profiles.school_id),
        full_name = coalesce(nullif(trim(teacher_name), ''), profiles.full_name)
    where profiles.id = existing;
    return 'existing';
  end if;
  insert into public.teacher_emails (email, full_name, school_id)
  values (clean, left(coalesce(trim(teacher_name), ''), 120), school)
  on conflict (email) do update set full_name = excluded.full_name, school_id = excluded.school_id, used_at = null;
  return 'ok';
end;
$$;

-- ---------- Admin: people (now with school) and changing someone's school ----------

drop function if exists public.admin_people(text, text);
create or replace function public.admin_people(passkey text, search text default '')
returns table (id uuid, full_name text, username text, email text, role text, school_id uuid, school_name text, created_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  term text := '%' || lower(trim(coalesce(search, ''))) || '%';
begin
  if public.admin_check(passkey) <> 'ok' then
    return;
  end if;
  return query
    select p.id, p.full_name, p.username, u.email::text, p.role, p.school_id, s.name, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.schools s on s.id = p.school_id
    where lower(p.full_name) like term or p.username like term or lower(u.email) like term
       or lower(coalesce(s.name, '')) like term
    order by p.role desc, p.full_name
    limit 500;
end;
$$;

create or replace function public.admin_set_school(passkey text, target uuid, school uuid)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  status text := public.admin_check(passkey);
begin
  if status <> 'ok' then
    return status;
  end if;
  if school is not null and not exists (select 1 from public.schools where id = school) then
    return 'not-found';
  end if;
  update public.profiles set school_id = school where profiles.id = target;
  return case when found then 'ok' else 'not-found' end;
end;
$$;

-- ---------- Merits ----------

create table if not exists public.merits (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  points smallint not null check (points between -10 and 10 and points <> 0),
  reason text not null check (length(trim(reason)) between 1 and 300),
  given_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists merits_student_idx on public.merits (student_id, created_at desc);

alter table public.merits enable row level security;

drop policy if exists "merits: student, giver or class teacher reads" on public.merits;
create policy "merits: student, giver or class teacher reads" on public.merits
  for select to authenticated
  using (
    student_id = auth.uid()
    or given_by = auth.uid()
    or (class_id is not null and public.teaches_class(class_id))
  );

drop policy if exists "merits: teacher gives to own class" on public.merits;
create policy "merits: teacher gives to own class" on public.merits
  for insert to authenticated
  with check (
    given_by = auth.uid()
    and class_id is not null
    and public.teaches_class(class_id)
    and exists (select 1 from public.class_members m where m.class_id = merits.class_id and m.user_id = student_id)
  );

drop policy if exists "merits: giver removes" on public.merits;
create policy "merits: giver removes" on public.merits
  for delete to authenticated using (given_by = auth.uid());

grant select, insert, delete on public.merits to authenticated;

-- ---------- Who may call what ----------

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.admin_schools(text) from public;
revoke execute on function public.admin_save_school(text, uuid, text) from public;
revoke execute on function public.admin_delete_school(text, uuid) from public;
revoke execute on function public.admin_prepare_teacher(text, text, text, uuid) from public;
revoke execute on function public.admin_people(text, text) from public;
revoke execute on function public.admin_set_school(text, uuid, uuid) from public;
grant execute on function public.admin_schools(text) to anon, authenticated;
grant execute on function public.admin_save_school(text, uuid, text) to anon, authenticated;
grant execute on function public.admin_delete_school(text, uuid) to anon, authenticated;
grant execute on function public.admin_prepare_teacher(text, text, text, uuid) to anon, authenticated;
grant execute on function public.admin_people(text, text) to anon, authenticated;
grant execute on function public.admin_set_school(text, uuid, uuid) to anon, authenticated;
