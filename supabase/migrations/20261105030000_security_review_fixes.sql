-- Fixes from the independent security review (5 Nov 2026), REV-01 … REV-10. Safe to run again.
--   REV-01 attempt limits: every try is counted BEFORE the check, so a read-only call can't test a
--          passkey or password for free; tries are serialised and limited per client too.
--   REV-02 people only see (and message) people they share a class, school (staff) or activity with.
--   REV-03 an existing account that becomes a teacher gets a new one-time password; pending
--          teacher emails expire after an hour.
--   REV-04 school-wide posts, calendar events and activities belong to a school; only the person
--          who added an event can change or delete it; activity rosters are not public.
--   REV-07 only the admin page sets someone's school; staff with no school fail the same-school rule.
--   REV-08 owners can't hand rows to someone else or change when they were made.
--   REV-09 longer class codes and a limit on wrong codes.
--   REV-10 graded work and its file can't be changed or deleted by the student.

-- ---------- Helpers ----------

-- Who is calling, as far as the API can tell (Cloudflare's address first; anything else is a hint).
create or replace function public.request_client()
returns text
language plpgsql stable set search_path = ''
as $$
declare
  h json;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    h := null;
  end;
  return left(coalesce(
    nullif(h ->> 'cf-connecting-ip', ''),
    nullif(h ->> 'x-real-ip', ''),
    nullif(trim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''),
    'unknown'), 64);
end;
$$;
revoke execute on function public.request_client() from public, anon, authenticated;

create or replace function public.my_school()
returns uuid
language sql stable security definer set search_path = ''
as $$ select school_id from public.profiles where id = auth.uid() $$;
revoke execute on function public.my_school() from public, anon;
grant execute on function public.my_school() to authenticated;

-- ---------- REV-01: passkey and username sign-in limits ----------

alter table public.admin_attempts add column if not exists client text not null default '';
alter table public.sign_in_attempts add column if not exists client text not null default '';
create index if not exists admin_attempts_client_idx on public.admin_attempts (client, attempted_at);
create index if not exists sign_in_attempts_client_idx on public.sign_in_attempts (client, attempted_at);

-- 'ok' | 'wrong' | 'locked' | 'unset'. Locked: 10 wrong tries from one client, or 100 from
-- everyone together, in 15 minutes.
create or replace function public.admin_check(passkey text)
returns text
language plpgsql
volatile
security definer set search_path = ''
as $$
declare
  s public.admin_settings;
  me text := public.request_client();
  attempt bigint;
begin
  perform pg_advisory_xact_lock(hashtext('schooling.admin_check'));
  -- Counted first: a read-only call fails here, before anything about the passkey is known.
  insert into public.admin_attempts (client) values (me) returning id into attempt;
  if (select count(*) from public.admin_attempts where client = me and attempted_at > now() - interval '15 minutes') > 10
     or (select count(*) from public.admin_attempts where attempted_at > now() - interval '15 minutes') > 100 then
    return 'locked';
  end if;
  select * into s from public.admin_settings where id = 1;
  if s.id is null then
    delete from public.admin_attempts where id = attempt;
    return 'unset';
  end if;
  if coalesce(passkey, '') = ''
     or encode(extensions.digest(s.passkey_salt || passkey, 'sha256'), 'hex') <> s.passkey_hash then
    delete from public.admin_attempts where attempted_at < now() - interval '1 day';
    return 'wrong';
  end if;
  delete from public.admin_attempts where id = attempt;
  -- Lets this transaction change roles past the protect_role trigger.
  perform set_config('schooling.admin_action', 'on', true);
  return 'ok';
end;
$$;

-- Username sign-in: 10 wrong tries per username, or 100 per client, in 15 minutes.
create or replace function public.email_for_sign_in(name text, password text)
returns text
language plpgsql
volatile
security definer set search_path = ''
as $$
declare
  uname text := lower(trim(coalesce(name, '')));
  me text := public.request_client();
  found_email text;
  hash text;
begin
  if uname = '' or coalesce(password, '') = '' then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtext('schooling.sign_in:' || uname));
  -- Counted first, for the same reason as admin_check.
  insert into public.sign_in_attempts (username, client) values (uname, me);
  if (select count(*) from public.sign_in_attempts where username = uname and attempted_at > now() - interval '15 minutes') > 10
     or (select count(*) from public.sign_in_attempts where client = me and attempted_at > now() - interval '15 minutes') > 100 then
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
  delete from public.sign_in_attempts where attempted_at < now() - interval '1 day';
  return null;
end;
$$;

-- ---------- REV-07: schools are set by the admin; staff need one ----------

-- True when a and b may work together: same school; or no school to compare (a student who
-- hasn't one yet, or no schools at all). Staff with no school fail once schools exist.
create or replace function public.same_school(a uuid, b uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(
    (select case
       when not exists (select 1 from public.schools) then true
       when (pa.role <> 'student' and pa.school_id is null) or (pb.role <> 'student' and pb.school_id is null) then false
       when pa.school_id is null or pb.school_id is null then true
       else pa.school_id = pb.school_id
     end
     from public.profiles pa, public.profiles pb
     where pa.id = a and pb.id = b),
    false);
$$;

-- People change their own name and username only (school and role go through the admin page).
revoke update on public.profiles from authenticated;
grant update (full_name, username) on public.profiles to authenticated;

-- ---------- REV-02: who can see whom ----------

create or replace function public.can_see_profile(target uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select target = auth.uid()
    or public.is_admin()
    -- classmates, and a class's teacher and students
    or exists (select 1 from public.class_members a join public.class_members b on a.class_id = b.class_id
               where a.user_id = auth.uid() and b.user_id = target)
    or exists (select 1 from public.classes c join public.class_members m on m.class_id = c.id
               where (c.teacher_id = auth.uid() and m.user_id = target)
                  or (c.teacher_id = target and m.user_id = auth.uid()))
    -- staff, and students with staff, at the same school (not student with student)
    or exists (select 1 from public.profiles me, public.profiles t
               where me.id = auth.uid() and t.id = target and me.school_id is not null
                 and me.school_id = t.school_id and (me.role <> 'student' or t.role <> 'student'))
    -- people in the same activity, and its leader
    or exists (select 1 from public.activity_members a join public.activity_members b on a.activity_id = b.activity_id
               where a.user_id = auth.uid() and b.user_id = target)
    or exists (select 1 from public.activities x join public.activity_members m on m.activity_id = x.id
               where (x.leader_id = auth.uid() and m.user_id = target)
                  or (x.leader_id = target and m.user_id = auth.uid()))
    -- anyone you already have a conversation with
    or exists (select 1 from public.messages
               where (sender_id = target and recipient_id = auth.uid())
                  or (sender_id = auth.uid() and recipient_id = target));
$$;
revoke execute on function public.can_see_profile(uuid) from public, anon;
grant execute on function public.can_see_profile(uuid) to authenticated;

drop policy if exists "profiles: signed-in users read" on public.profiles;
drop policy if exists "profiles: people you know read" on public.profiles;
create policy "profiles: people you know read" on public.profiles
  for select to authenticated using (public.can_see_profile(id));

drop policy if exists "messages: send as yourself" on public.messages;
create policy "messages: send as yourself" on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and recipient_id <> (select auth.uid()) and public.can_see_profile(recipient_id));

-- ---------- REV-03: teacher accounts ----------

alter table public.teacher_emails add column if not exists created_at timestamptz not null default now();

-- Pending teacher emails count for one hour (the admin page makes the account straight away).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  t public.teacher_emails;
  school uuid := public.try_uuid(new.raw_user_meta_data ->> 'school_id');
begin
  select * into t from public.teacher_emails
   where email = lower(new.email) and used_at is null and created_at > now() - interval '1 hour'
   for update;
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

  -- Used (or out of date) teacher emails are not kept.
  delete from public.teacher_emails where email = lower(new.email) or created_at < now() - interval '1 hour';
  return new;
end;
$$;

-- 'ok' = make the account now with new_password; 'existing' = that email already had an
-- account: it is now a teacher and its password is new_password (whoever made it is locked out).
drop function if exists public.admin_prepare_teacher(text, text, text, uuid);
create or replace function public.admin_prepare_teacher(passkey text, teacher_email text, teacher_name text, school uuid, new_password text)
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
  if length(coalesce(new_password, '')) < 8 then
    return 'weak';
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
    update auth.users
       set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')), updated_at = now()
     where id = existing;
    if to_regclass('auth.sessions') is not null then
      execute 'delete from auth.sessions where user_id = $1' using existing;
    end if;
    return 'existing';
  end if;
  delete from public.teacher_emails where created_at < now() - interval '1 hour';
  insert into public.teacher_emails (email, full_name, school_id)
  values (clean, left(coalesce(trim(teacher_name), ''), 120), school)
  on conflict (email) do update set full_name = excluded.full_name, school_id = excluded.school_id, used_at = null, created_at = now();
  return 'ok';
end;
$$;
revoke execute on function public.admin_prepare_teacher(text, text, text, uuid, text) from public;
grant execute on function public.admin_prepare_teacher(text, text, text, uuid, text) to anon, authenticated;

-- ---------- REV-04: school-wide things belong to a school ----------

alter table public.announcements add column if not exists school_id uuid references public.schools (id) on delete set null;
alter table public.events add column if not exists school_id uuid references public.schools (id) on delete set null;
alter table public.activities add column if not exists school_id uuid references public.schools (id) on delete set null;
create index if not exists announcements_school_id_idx on public.announcements (school_id);
create index if not exists events_school_id_idx on public.events (school_id);
create index if not exists activities_school_id_idx on public.activities (school_id);

-- The school comes from the person who adds it (tg_argv[0] names that column) and never changes.
create or replace function public.stamp_school()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.school_id := old.school_id;
  else
    new.school_id := (select school_id from public.profiles where id = (to_jsonb(new) ->> tg_argv[0])::uuid);
  end if;
  return new;
end;
$$;
revoke execute on function public.stamp_school() from public, anon, authenticated;

drop trigger if exists announcements_school on public.announcements;
create trigger announcements_school before insert or update on public.announcements
  for each row execute function public.stamp_school('author_id');
drop trigger if exists events_school on public.events;
create trigger events_school before insert or update on public.events
  for each row execute function public.stamp_school('created_by');
drop trigger if exists activities_school on public.activities;
create trigger activities_school before insert or update on public.activities
  for each row execute function public.stamp_school('leader_id');

update public.announcements a set school_id = p.school_id from public.profiles p where p.id = a.author_id and a.school_id is null;
update public.events e set school_id = p.school_id from public.profiles p where p.id = e.created_by and e.school_id is null;
update public.activities x set school_id = p.school_id from public.profiles p where p.id = x.leader_id and x.school_id is null;

drop policy if exists "announcements: read school-wide or own classes" on public.announcements;
create policy "announcements: read school-wide or own classes" on public.announcements
  for select to authenticated
  using (
    (class_id is null and (school_id is not distinct from public.my_school() or author_id = (select auth.uid())))
    or (class_id is not null and public.in_class(class_id))
    or public.is_admin()
  );

drop policy if exists "events: everyone reads" on public.events;
drop policy if exists "events: same school reads" on public.events;
create policy "events: same school reads" on public.events
  for select to authenticated
  using (school_id is not distinct from public.my_school() or created_by = (select auth.uid()) or public.is_admin());
drop policy if exists "events: staff updates" on public.events;
drop policy if exists "events: creator updates" on public.events;
create policy "events: creator updates" on public.events
  for update to authenticated
  using (created_by = (select auth.uid()) or public.is_admin())
  with check (created_by = (select auth.uid()) or public.is_admin());
drop policy if exists "events: staff deletes" on public.events;
drop policy if exists "events: creator deletes" on public.events;
create policy "events: creator deletes" on public.events
  for delete to authenticated using (created_by = (select auth.uid()) or public.is_admin());

drop policy if exists "activities: everyone reads" on public.activities;
drop policy if exists "activities: same school reads" on public.activities;
create policy "activities: same school reads" on public.activities
  for select to authenticated
  using (school_id is not distinct from public.my_school() or leader_id = (select auth.uid()) or public.is_admin());

create or replace function public.in_activity(aid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.activity_members where activity_id = aid and user_id = auth.uid())
      or exists (select 1 from public.activities where id = aid and leader_id = auth.uid())
$$;
revoke execute on function public.in_activity(uuid) from public, anon;
grant execute on function public.in_activity(uuid) to authenticated;

-- Rosters: the members themselves, the leader, and staff at that school.
drop policy if exists "activity_members: everyone reads" on public.activity_members;
drop policy if exists "activity_members: members, leader and staff read" on public.activity_members;
create policy "activity_members: members, leader and staff read" on public.activity_members
  for select to authenticated
  using (
    public.in_activity(activity_id)
    or (public.is_staff() and exists (select 1 from public.activities x where x.id = activity_id))
  );
drop policy if exists "activity_members: join yourself" on public.activity_members;
create policy "activity_members: join yourself" on public.activity_members
  for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.activities x where x.id = activity_id));

-- ---------- REV-08: owners stay owners ----------

drop policy if exists "classes: teacher updates" on public.classes;
create policy "classes: teacher updates" on public.classes
  for update to authenticated
  using (public.teaches_class(id))
  with check (public.teaches_class(id) and (teacher_id = (select auth.uid()) or public.is_admin()));
revoke update on public.classes from authenticated;
grant update (name, subject) on public.classes to authenticated;

drop policy if exists "announcements: author or admin edits" on public.announcements;
create policy "announcements: author or admin edits" on public.announcements
  for update to authenticated
  using (author_id = (select auth.uid()) or public.is_admin())
  with check (
    (author_id = (select auth.uid()) or public.is_admin())
    and ((class_id is null and public.is_staff()) or (class_id is not null and public.teaches_class(class_id)))
  );
revoke update on public.announcements from authenticated;
grant update (title, body) on public.announcements to authenticated;

revoke update on public.events from authenticated;
grant update (title, description, starts_on, ends_on, category) on public.events to authenticated;
revoke update on public.activities from authenticated;
grant update (name, description, meets) on public.activities to authenticated;

-- ---------- REV-09: class codes ----------

-- 8 characters from 32 (no 0/O or 1/I): about a trillion codes.
create or replace function public.new_join_code()
returns text
language sql volatile security definer set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(b, i) % 32) + 1, 1), '' order by i)
  from (select extensions.gen_random_bytes(8) as b) r, generate_series(0, 7) as i
$$;
revoke execute on function public.new_join_code() from public, anon;
grant execute on function public.new_join_code() to authenticated;

create table if not exists public.join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists join_attempts_user_idx on public.join_attempts (user_id, attempted_at);
alter table public.join_attempts enable row level security;
revoke all on public.join_attempts from public, anon, authenticated;

-- Returns the class id, or 'not-found' | 'other-school' | 'too-many'. It returns instead of
-- raising so that wrong codes stay counted (20 per 15 minutes per person).
drop function if exists public.join_class(text);
create or replace function public.join_class(code text)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  cid uuid;
  tid uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  insert into public.join_attempts (user_id) values (auth.uid());
  delete from public.join_attempts where attempted_at < now() - interval '1 day';
  if (select count(*) from public.join_attempts where user_id = auth.uid() and attempted_at > now() - interval '15 minutes') > 20 then
    return 'too-many';
  end if;
  select id, teacher_id into cid, tid from public.classes where join_code = upper(trim(coalesce(code, '')));
  if cid is null then
    return 'not-found';
  end if;
  if not public.same_school(auth.uid(), tid) then
    return 'other-school';
  end if;
  insert into public.class_members (class_id, user_id) values (cid, auth.uid()) on conflict do nothing;
  delete from public.join_attempts where user_id = auth.uid();
  return cid::text;
end;
$$;
revoke execute on function public.join_class(text) from public, anon;
grant execute on function public.join_class(text) to authenticated;

-- ---------- REV-10: graded work is final ----------

drop policy if exists "submissions: student edits own, teacher grades" on public.submissions;
drop policy if exists "submissions: student edits own ungraded" on public.submissions;
drop policy if exists "submissions: teacher grades" on public.submissions;
create policy "submissions: student edits own ungraded" on public.submissions
  for update to authenticated
  using (student_id = (select auth.uid()) and graded_at is null)
  with check (student_id = (select auth.uid()));
create policy "submissions: teacher grades" on public.submissions
  for update to authenticated
  using (public.teaches_class(public.assignment_class(assignment_id)))
  with check (public.teaches_class(public.assignment_class(assignment_id)));
drop policy if exists "submissions: student withdraws ungraded" on public.submissions;
create policy "submissions: student withdraws ungraded" on public.submissions
  for delete to authenticated
  using (student_id = (select auth.uid()) and grade is null and graded_at is null);

drop policy if exists "class-files: delete" on storage.objects;
create policy "class-files: delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'class-files'
    and (
      ((storage.foldername(name))[2] = 'materials'
        and public.teaches_class(public.try_uuid((storage.foldername(name))[1])))
      or ((storage.foldername(name))[2] = 'submissions'
        and (storage.foldername(name))[3] = (select auth.uid())::text
        and not exists (select 1 from public.submissions s where s.file_path = name and s.graded_at is not null))
      -- REV-14: a teacher deleting a class also clears its handed-in files
      or ((storage.foldername(name))[2] = 'submissions'
        and public.teaches_class(public.try_uuid((storage.foldername(name))[1])))
    )
  );

-- ---------- REV-13: counts worked out in the database ----------

-- Per assignment you can see: how many handed in, how many still to grade (rules apply as usual).
create or replace function public.submission_counts()
returns table (assignment_id uuid, handed_in bigint, to_grade bigint)
language sql stable set search_path = ''
as $$
  select s.assignment_id, count(*), count(*) filter (where s.grade is null and s.graded_at is null)
  from public.submissions s group by s.assignment_id
$$;
revoke execute on function public.submission_counts() from public, anon;
grant execute on function public.submission_counts() to authenticated;

-- A student's own attendance totals.
create or replace function public.my_attendance_totals()
returns table (status text, n bigint)
language sql stable set search_path = ''
as $$ select a.status, count(*) from public.attendance a where a.student_id = auth.uid() group by a.status $$;
revoke execute on function public.my_attendance_totals() from public, anon;
grant execute on function public.my_attendance_totals() to authenticated;
