-- Fixes from the Supabase security and performance advisors (5 Nov 2026). Safe to run again.
-- Nothing here changes who can see or change what: the access rules keep the same meaning.

-- ---------- Functions: fixed search_path (they only use built-ins) ----------
alter function public.new_join_code() set search_path = '';
alter function public.try_uuid(text) set search_path = '';
alter function public.touch_updated_at() set search_path = '';

-- ---------- Indexes on foreign keys (faster joins and deletes) ----------
create index if not exists activities_leader_id_idx on public.activities (leader_id);
create index if not exists activity_members_user_id_idx on public.activity_members (user_id);
create index if not exists announcements_author_id_idx on public.announcements (author_id);
create index if not exists assignments_created_by_idx on public.assignments (created_by);
create index if not exists attendance_marked_by_idx on public.attendance (marked_by);
create index if not exists attendance_student_id_idx on public.attendance (student_id);
create index if not exists classes_teacher_id_idx on public.classes (teacher_id);
create index if not exists events_created_by_idx on public.events (created_by);
create index if not exists materials_uploaded_by_idx on public.materials (uploaded_by);
create index if not exists merits_class_id_idx on public.merits (class_id);
create index if not exists merits_given_by_idx on public.merits (given_by);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists profiles_school_id_idx on public.profiles (school_id);
create index if not exists reports_author_id_idx on public.reports (author_id);
create index if not exists reports_class_id_idx on public.reports (class_id);
create index if not exists submissions_student_id_idx on public.submissions (student_id);
create index if not exists teacher_emails_school_id_idx on public.teacher_emails (school_id);
create index if not exists timetable_slots_class_id_idx on public.timetable_slots (class_id);

-- ---------- Primary keys on the attempt logs ----------
alter table public.sign_in_attempts add column if not exists id bigint generated always as identity primary key;
alter table public.admin_attempts add column if not exists id bigint generated always as identity primary key;

-- ---------- Access rules: work out the signed-in user once per query, not once per row ----------
-- Same rules as before; auth.uid() is wrapped in (select ...) as Supabase recommends.
alter policy "activities: leader or admin deletes" on public.activities
  using (((leader_id = (select auth.uid())) OR is_admin()));
alter policy "activities: leader or admin updates" on public.activities
  using (((leader_id = (select auth.uid())) OR is_admin()))
  with check (((leader_id = (select auth.uid())) OR is_admin()));
alter policy "activities: staff creates" on public.activities
  with check ((is_staff() AND (leader_id = (select auth.uid()))));
alter policy "activity_members: join yourself" on public.activity_members
  with check ((user_id = (select auth.uid())));
alter policy "activity_members: leave or leader removes" on public.activity_members
  using (((user_id = (select auth.uid())) OR is_admin() OR (EXISTS ( SELECT 1
   FROM activities a
  WHERE ((a.id = activity_members.activity_id) AND (a.leader_id = (select auth.uid())))))));
alter policy "announcements: author or admin deletes" on public.announcements
  using (((author_id = (select auth.uid())) OR is_admin()));
alter policy "announcements: author or admin edits" on public.announcements
  using (((author_id = (select auth.uid())) OR is_admin()))
  with check ((((class_id IS NULL) AND is_staff()) OR ((class_id IS NOT NULL) AND teaches_class(class_id))));
alter policy "announcements: staff post" on public.announcements
  with check (((author_id = (select auth.uid())) AND (((class_id IS NULL) AND is_staff()) OR ((class_id IS NOT NULL) AND teaches_class(class_id)))));
alter policy "attendance: own or teacher reads" on public.attendance
  using (((student_id = (select auth.uid())) OR teaches_class(class_id)));
alter policy "class_members: teacher adds" on public.class_members
  with check ((teaches_class(class_id) AND same_school((select auth.uid()), user_id)));
alter policy "class_members: teacher removes or student leaves" on public.class_members
  using ((teaches_class(class_id) OR (user_id = (select auth.uid()))));
alter policy "classes: members read" on public.classes
  using (((teacher_id = (select auth.uid())) OR in_class(id)));
alter policy "classes: staff create own" on public.classes
  with check ((is_staff() AND (teacher_id = (select auth.uid()))));
alter policy "events: staff adds" on public.events
  with check ((is_staff() AND (created_by = (select auth.uid()))));
alter policy "merits: giver edits" on public.merits
  using ((given_by = (select auth.uid())))
  with check ((given_by = (select auth.uid())));
alter policy "merits: giver removes" on public.merits
  using ((given_by = (select auth.uid())));
alter policy "merits: student, giver or class teacher reads" on public.merits
  using (((student_id = (select auth.uid())) OR (given_by = (select auth.uid())) OR ((class_id IS NOT NULL) AND teaches_class(class_id))));
alter policy "merits: teacher gives to own class" on public.merits
  with check (((given_by = (select auth.uid())) AND (class_id IS NOT NULL) AND teaches_class(class_id) AND (EXISTS ( SELECT 1
   FROM class_members m
  WHERE ((m.class_id = merits.class_id) AND (m.user_id = merits.student_id)))) AND same_school((select auth.uid()), student_id)));
alter policy "messages: participants read" on public.messages
  using (((sender_id = (select auth.uid())) OR (recipient_id = (select auth.uid()))));
alter policy "messages: send as yourself" on public.messages
  with check ((sender_id = (select auth.uid())));
alter policy "messages: sender deletes" on public.messages
  using ((sender_id = (select auth.uid())));
alter policy "profiles: update own or admin" on public.profiles
  using (((id = (select auth.uid())) OR is_admin()))
  with check (((id = (select auth.uid())) OR is_admin()));
alter policy "reports: student reads published, teacher reads all" on public.reports
  using ((((student_id = (select auth.uid())) AND published) OR teaches_class(class_id)));
alter policy "submissions: own or teacher reads" on public.submissions
  using (((student_id = (select auth.uid())) OR teaches_class(assignment_class(assignment_id))));
alter policy "submissions: student edits own, teacher grades" on public.submissions
  using (((student_id = (select auth.uid())) OR teaches_class(assignment_class(assignment_id))));
alter policy "submissions: student hands in" on public.submissions
  with check (((student_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM class_members m
  WHERE ((m.class_id = assignment_class(submissions.assignment_id)) AND (m.user_id = (select auth.uid())))))));
alter policy "submissions: student withdraws ungraded" on public.submissions
  using (((student_id = (select auth.uid())) AND (grade IS NULL)));
