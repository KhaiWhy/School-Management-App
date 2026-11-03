-- Schooling: full schema, access rules (RLS) and file storage.
-- Run once in Supabase → SQL Editor (paste the whole file → Run).
-- Roles: everyone starts as 'student'. Make teachers/admins with:
--   update public.profiles set role = 'teacher' where email = '...';

-- ============================================================
-- People
-- ============================================================

-- Email stays in auth.users (private). Others only ever see name, username and role.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (length(full_name) <= 120),
  username text not null unique check (username ~ '^[a-z0-9._]{3,30}$'),
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now()
);

-- Username from the email ("sam.tan@x.com" → "sam.tan"), with a number added if taken.
create function public.username_from_email(email text)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  base text := left(lower(regexp_replace(split_part(coalesce(email, ''), '@', 1), '[^a-zA-Z0-9._]', '', 'g')), 24);
  candidate text;
  n int := 1;
begin
  if length(base) < 3 then
    base := rpad(base, 3, '0');
  end if;
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || n;
  end loop;
  return candidate;
end;
$$;

-- Make a profile when someone signs up. The role is never taken from sign-up data.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    public.username_from_email(new.email)
  );
  return new;
end;
$$;

-- Username sign-in: the server (service role) looks up the email. Never callable from the browser.
create function public.email_for_username(name text)
returns text
language sql stable security definer set search_path = ''
as $$
  select u.email from auth.users u
  join public.profiles p on p.id = u.id
  where p.username = lower(trim(name))
$$;

revoke execute on function public.email_for_username(text) from public, anon, authenticated;
revoke execute on function public.username_from_email(text) from public, anon, authenticated;
grant execute on function public.email_for_username(text) to service_role;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Helpers used by the access rules ----------
-- security definer so they can read tables without tripping the rules they help define.

create function public.my_role()
returns text
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.my_role() = 'admin', false) $$;

create function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.my_role() in ('teacher', 'admin'), false) $$;

-- Only admins change roles; the SQL Editor (no signed-in user) always can.
create function public.protect_role()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  new.id := old.id;
  new.username := lower(trim(new.username));
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_role();

alter table public.profiles enable row level security;

create policy "profiles: signed-in users read"
  on public.profiles for select to authenticated using (true);

create policy "profiles: update own or admin"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ============================================================
-- Classes
-- ============================================================

create function public.new_join_code()
returns text
language sql volatile
as $$ select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)) $$;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  subject text check (length(subject) <= 80),
  teacher_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  join_code text not null unique default public.new_join_code(),
  created_at timestamptz not null default now()
);

create table public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

create index class_members_user_idx on public.class_members (user_id);

create function public.teaches_class(cid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
      or exists (select 1 from public.classes where id = cid and teacher_id = auth.uid())
$$;

create function public.in_class(cid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.teaches_class(cid)
      or exists (select 1 from public.class_members where class_id = cid and user_id = auth.uid())
$$;

-- Students join with the class code (like Google Classroom).
create function public.join_class(code text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  cid uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  select id into cid from public.classes where join_code = upper(trim(code));
  if cid is null then
    raise exception 'No class has that code';
  end if;
  insert into public.class_members (class_id, user_id)
  values (cid, auth.uid())
  on conflict do nothing;
  return cid;
end;
$$;

revoke execute on function public.join_class(text) from public, anon;
grant execute on function public.join_class(text) to authenticated;

alter table public.classes enable row level security;
alter table public.class_members enable row level security;

-- teacher_id check first: a class just created isn't visible to in_class() yet.
create policy "classes: members read" on public.classes
  for select to authenticated using (teacher_id = auth.uid() or public.in_class(id));
create policy "classes: staff create own" on public.classes
  for insert to authenticated with check (public.is_staff() and teacher_id = auth.uid());
create policy "classes: teacher updates" on public.classes
  for update to authenticated using (public.teaches_class(id)) with check (public.teaches_class(id));
create policy "classes: teacher deletes" on public.classes
  for delete to authenticated using (public.teaches_class(id));

create policy "class_members: classmates read" on public.class_members
  for select to authenticated using (public.in_class(class_id));
create policy "class_members: teacher adds" on public.class_members
  for insert to authenticated with check (public.teaches_class(class_id));
create policy "class_members: teacher removes or student leaves" on public.class_members
  for delete to authenticated using (public.teaches_class(class_id) or user_id = auth.uid());

-- ============================================================
-- Announcements (class_id null = whole school)
-- ============================================================

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  body text not null check (length(trim(body)) between 1 and 10000),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index announcements_class_idx on public.announcements (class_id, created_at desc);

create trigger announcements_touch
  before update on public.announcements
  for each row execute function public.touch_updated_at();

alter table public.announcements enable row level security;

create policy "announcements: read school-wide or own classes" on public.announcements
  for select to authenticated
  using (class_id is null or public.in_class(class_id));
create policy "announcements: staff post" on public.announcements
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and ((class_id is null and public.is_staff()) or (class_id is not null and public.teaches_class(class_id)))
  );
create policy "announcements: author or admin edits" on public.announcements
  for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (
    (class_id is null and public.is_staff()) or (class_id is not null and public.teaches_class(class_id))
  );
create policy "announcements: author or admin deletes" on public.announcements
  for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- ============================================================
-- Assignments and submissions
-- ============================================================

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 10000),
  due_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index assignments_class_idx on public.assignments (class_id, due_at);

create function public.assignment_class(aid uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$ select class_id from public.assignments where id = aid $$;

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null default '' check (length(body) <= 20000),
  file_path text,
  file_name text,
  submitted_at timestamptz not null default now(),
  grade text check (length(grade) <= 20),
  feedback text check (length(feedback) <= 5000),
  graded_at timestamptz,
  unique (assignment_id, student_id)
);

-- Students may only change their work; teachers may only change the grade and feedback.
create function public.guard_submission()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  is_teacher boolean := public.teaches_class(public.assignment_class(coalesce(new.assignment_id, old.assignment_id)));
begin
  if tg_op = 'INSERT' then
    if not is_teacher then
      new.grade := null;
      new.feedback := null;
      new.graded_at := null;
    end if;
    new.submitted_at := now();
    return new;
  end if;

  new.assignment_id := old.assignment_id;
  new.student_id := old.student_id;
  if is_teacher and old.student_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    new.body := old.body;
    new.file_path := old.file_path;
    new.file_name := old.file_name;
    new.submitted_at := old.submitted_at;
    if new.grade is distinct from old.grade or new.feedback is distinct from old.feedback then
      new.graded_at := now();
    end if;
  elsif auth.uid() is not null then
    new.grade := old.grade;
    new.feedback := old.feedback;
    new.graded_at := old.graded_at;
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

create trigger submissions_guard
  before insert or update on public.submissions
  for each row execute function public.guard_submission();

alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

create policy "assignments: class reads" on public.assignments
  for select to authenticated using (public.in_class(class_id));
create policy "assignments: teacher creates" on public.assignments
  for insert to authenticated with check (public.teaches_class(class_id));
create policy "assignments: teacher updates" on public.assignments
  for update to authenticated using (public.teaches_class(class_id)) with check (public.teaches_class(class_id));
create policy "assignments: teacher deletes" on public.assignments
  for delete to authenticated using (public.teaches_class(class_id));

create policy "submissions: own or teacher reads" on public.submissions
  for select to authenticated
  using (student_id = auth.uid() or public.teaches_class(public.assignment_class(assignment_id)));
create policy "submissions: student hands in" on public.submissions
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.class_members m
      where m.class_id = public.assignment_class(assignment_id) and m.user_id = auth.uid()
    )
  );
create policy "submissions: student edits own, teacher grades" on public.submissions
  for update to authenticated
  using (student_id = auth.uid() or public.teaches_class(public.assignment_class(assignment_id)));
create policy "submissions: student withdraws ungraded" on public.submissions
  for delete to authenticated
  using (student_id = auth.uid() and grade is null);

-- ============================================================
-- Class materials
-- ============================================================

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 5000),
  file_path text,
  file_name text,
  link_url text check (link_url is null or link_url ~* '^https?://'),
  uploaded_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index materials_class_idx on public.materials (class_id, created_at desc);

alter table public.materials enable row level security;

create policy "materials: class reads" on public.materials
  for select to authenticated using (public.in_class(class_id));
create policy "materials: teacher adds" on public.materials
  for insert to authenticated with check (public.teaches_class(class_id));
create policy "materials: teacher updates" on public.materials
  for update to authenticated using (public.teaches_class(class_id)) with check (public.teaches_class(class_id));
create policy "materials: teacher deletes" on public.materials
  for delete to authenticated using (public.teaches_class(class_id));

-- ============================================================
-- Attendance
-- ============================================================

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  on_date date not null,
  status text not null check (status in ('present', 'late', 'absent', 'excused')),
  note text check (length(note) <= 500),
  marked_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  marked_at timestamptz not null default now(),
  unique (class_id, student_id, on_date)
);

alter table public.attendance enable row level security;

create policy "attendance: own or teacher reads" on public.attendance
  for select to authenticated using (student_id = auth.uid() or public.teaches_class(class_id));
create policy "attendance: teacher marks members" on public.attendance
  for insert to authenticated
  with check (
    public.teaches_class(class_id)
    and exists (select 1 from public.class_members m where m.class_id = attendance.class_id and m.user_id = student_id)
  );
create policy "attendance: teacher updates" on public.attendance
  for update to authenticated using (public.teaches_class(class_id)) with check (public.teaches_class(class_id));
create policy "attendance: teacher deletes" on public.attendance
  for delete to authenticated using (public.teaches_class(class_id));

-- ============================================================
-- Timetable and school calendar
-- ============================================================

create table public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- 1 = Monday
  starts_at time not null,
  ends_at time not null,
  room text check (length(room) <= 40),
  check (ends_at > starts_at)
);

alter table public.timetable_slots enable row level security;

create policy "timetable: class reads" on public.timetable_slots
  for select to authenticated using (public.in_class(class_id));
create policy "timetable: teacher adds" on public.timetable_slots
  for insert to authenticated with check (public.teaches_class(class_id));
create policy "timetable: teacher updates" on public.timetable_slots
  for update to authenticated using (public.teaches_class(class_id)) with check (public.teaches_class(class_id));
create policy "timetable: teacher deletes" on public.timetable_slots
  for delete to authenticated using (public.teaches_class(class_id));

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 5000),
  starts_on date not null,
  ends_on date,
  category text not null default 'event' check (category in ('term', 'holiday', 'exam', 'event')),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

alter table public.events enable row level security;

create policy "events: everyone reads" on public.events
  for select to authenticated using (true);
create policy "events: staff adds" on public.events
  for insert to authenticated with check (public.is_staff() and created_by = auth.uid());
create policy "events: staff updates" on public.events
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "events: staff deletes" on public.events
  for delete to authenticated using (public.is_staff());

-- ============================================================
-- Activities (CCAs / after-school)
-- ============================================================

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 5000),
  meets text not null default '' check (length(meets) <= 120), -- e.g. "Tuesdays 3–5pm, Hall"
  leader_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.activity_members (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

alter table public.activities enable row level security;
alter table public.activity_members enable row level security;

create policy "activities: everyone reads" on public.activities
  for select to authenticated using (true);
create policy "activities: staff creates" on public.activities
  for insert to authenticated with check (public.is_staff() and leader_id = auth.uid());
create policy "activities: leader or admin updates" on public.activities
  for update to authenticated
  using (leader_id = auth.uid() or public.is_admin())
  with check (leader_id = auth.uid() or public.is_admin());
create policy "activities: leader or admin deletes" on public.activities
  for delete to authenticated using (leader_id = auth.uid() or public.is_admin());

create policy "activity_members: everyone reads" on public.activity_members
  for select to authenticated using (true);
create policy "activity_members: join yourself" on public.activity_members
  for insert to authenticated with check (user_id = auth.uid());
create policy "activity_members: leave or leader removes" on public.activity_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.activities a where a.id = activity_id and a.leader_id = auth.uid())
  );

-- ============================================================
-- Direct messages
-- ============================================================

create table public.messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index messages_pair_idx on public.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at);
create index messages_recipient_idx on public.messages (recipient_id, created_at desc);

alter table public.messages enable row level security;

create policy "messages: participants read" on public.messages
  for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "messages: send as yourself" on public.messages
  for insert to authenticated with check (sender_id = auth.uid());
create policy "messages: sender deletes" on public.messages
  for delete to authenticated using (sender_id = auth.uid());

-- Live updates for new messages.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- ============================================================
-- School reports
-- ============================================================

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  term text not null check (length(trim(term)) between 1 and 40),
  grade text not null default '' check (length(grade) <= 20),
  comment text not null default '' check (length(comment) <= 5000),
  published boolean not null default false,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, class_id, term)
);

create trigger reports_touch
  before update on public.reports
  for each row execute function public.touch_updated_at();

alter table public.reports enable row level security;

create policy "reports: student reads published, teacher reads all" on public.reports
  for select to authenticated
  using ((student_id = auth.uid() and published) or public.teaches_class(class_id));
create policy "reports: teacher writes for members" on public.reports
  for insert to authenticated
  with check (
    public.teaches_class(class_id)
    and exists (select 1 from public.class_members m where m.class_id = reports.class_id and m.user_id = student_id)
  );
create policy "reports: teacher updates" on public.reports
  for update to authenticated using (public.teaches_class(class_id)) with check (public.teaches_class(class_id));
create policy "reports: teacher deletes" on public.reports
  for delete to authenticated using (public.teaches_class(class_id));

-- ============================================================
-- File storage: one private bucket for class files
--   <class_id>/materials/<file>               teacher uploads, class reads
--   <class_id>/submissions/<student_id>/<file> student uploads own, teacher reads
-- ============================================================

create function public.try_uuid(value text)
returns uuid
language plpgsql immutable
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('class-files', 'class-files', false, 20971520) -- 20 MB per file
on conflict (id) do nothing;

create policy "class-files: read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'class-files'
    and public.in_class(public.try_uuid((storage.foldername(name))[1]))
    and (
      (storage.foldername(name))[2] = 'materials'
      or (storage.foldername(name))[3] = auth.uid()::text
      or public.teaches_class(public.try_uuid((storage.foldername(name))[1]))
    )
  );

create policy "class-files: upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'class-files'
    and (
      ((storage.foldername(name))[2] = 'materials'
        and public.teaches_class(public.try_uuid((storage.foldername(name))[1])))
      or ((storage.foldername(name))[2] = 'submissions'
        and (storage.foldername(name))[3] = auth.uid()::text
        and public.in_class(public.try_uuid((storage.foldername(name))[1])))
    )
  );

create policy "class-files: delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'class-files'
    and (
      ((storage.foldername(name))[2] = 'materials'
        and public.teaches_class(public.try_uuid((storage.foldername(name))[1])))
      or ((storage.foldername(name))[2] = 'submissions'
        and (storage.foldername(name))[3] = auth.uid()::text)
    )
  );
