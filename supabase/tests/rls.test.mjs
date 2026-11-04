// Checks every access rule in the database, without needing Supabase or Docker:
// runs the migrations on PGlite (Postgres in WebAssembly) with a small Supabase stand-in
// (auth.users, auth.uid(), storage, the anon/authenticated/service_role roles).
// Run: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../migrations/', import.meta.url);
const migration = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(new URL(f, dir), 'utf8'))
  .join(';\n');
const db = new PGlite({ extensions: { pgcrypto } });

await db.exec(`
  create role authenticated nologin;
  create role anon nologin;
  create role service_role nologin;
  create schema auth;
  create schema extensions;
  create extension pgcrypto with schema extensions;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', encrypted_password text, updated_at timestamptz);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable
    as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
`);
// Supabase's defaults: new tables and functions are granted to the API roles.
await db.exec(`
  grant usage on schema public, storage, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  grant select, insert, update, delete on all tables in schema storage to authenticated;
  grant execute on all functions in schema auth, storage to authenticated, service_role;
`);
await db.exec(migration);

const ids = {};
for (const [key, n] of Object.entries({ A: 1, T: 2, T2: 3, S1: 4, S2: 5, S3: 6 })) {
  ids[key] = `00000000-0000-0000-0000-00000000000${n}`;
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data, encrypted_password)
     values ($1, $2, $3, extensions.crypt('pass-' || $4, extensions.gen_salt('bf', 4)))`,
    [ids[key], `${key.toLowerCase()}@school.test`, { full_name: key, role: 'admin' }, key],
  );
}
// SQL Editor (no signed-in user) promotes staff.
await db.query(`update public.profiles set role = 'admin' where id = $1`, [ids.A]);
await db.query(`update public.profiles set role = 'teacher' where id = any($1)`, [[ids.T, ids.T2]]);

let pass = 0;
const failures = [];

async function as(who, sql, params = []) {
  await db.exec(who === 'SERVICE' ? `set role service_role` : who === 'ANON' ? `set role anon` : `set role authenticated`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [ids[who]]);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec(`reset role`);
  }
}

async function ok(label, who, sql, params) {
  try {
    const res = await as(who, sql, params);
    pass++;
    return res;
  } catch (e) {
    failures.push(`${label}: expected OK, got ${e.message}`);
  }
}

async function denied(label, who, sql, params) {
  try {
    const res = await as(who, sql, params);
    if (res.affectedRows === 0 && /^\s*(update|delete)/i.test(sql)) { pass++; return; }
    failures.push(`${label}: expected denial, but it worked`);
  } catch {
    pass++;
  }
}

async function count(label, who, sql, params, expected) {
  const res = await ok(label, who, sql, params);
  if (!res) return;
  const n = res.rows.length;
  if (n !== expected) { pass--; failures.push(`${label}: expected ${expected} rows, got ${n}`); }
}

function check(label, cond) {
  if (cond) pass++; else failures.push(label);
}

// ---------- usernames ----------
await db.query(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000009', 'S1@other.test')`);
const names = await db.query(`select id, username from public.profiles order by id`);
const byId = Object.fromEntries(names.rows.map((r) => [r.id, r.username]));
check('username from email', byId[ids.S1] === 's10');
check('short username padded', byId[ids.A] === 'a00');
check('duplicate username gets a number', byId['00000000-0000-0000-0000-000000000009'] === 's102');
// Username sign-in: the email comes back only with the right password.
const right = await ok('right password gives the email', 'ANON', `select public.email_for_sign_in(' S20 ', 'pass-S2') as email`);
check('email returned', right && right.rows[0].email === 's2@school.test');
const wrong = await ok('wrong password', 'ANON', `select public.email_for_sign_in('s20', 'nope') as email`);
check('wrong password gives nothing', wrong && wrong.rows[0].email === null);
const nobody = await ok('unknown user', 'ANON', `select public.email_for_sign_in('nobody', 'pass-S2') as email`);
check('unknown user gives nothing', nobody && nobody.rows[0].email === null);
await denied('old server lookup is gone', 'SERVICE', `select public.email_for_username('s20')`);
await denied('nobody reads sign-in attempts', 'ANON', `select * from public.sign_in_attempts`);
for (let i = 0; i < 10; i++) await as('ANON', `select public.email_for_sign_in('t00', 'wrong')`);
await denied('11th try in 15 minutes is blocked, even with the right password', 'ANON', `select public.email_for_sign_in('t00', 'pass-T')`);
const other = await ok('other users unaffected by the block', 'ANON', `select public.email_for_sign_in('s30', 'pass-S3') as email`);
check('other user still signs in', other && other.rows[0].email === 's3@school.test');
await ok('student changes username', 'S1', `update public.profiles set username = 'Sam.Tan' where id = $1`, [ids.S1]);
const renamed = await db.query(`select username from public.profiles where id = $1`, [ids.S1]);
check('username lowercased', renamed.rows[0].username === 'sam.tan');
await denied('username taken', 'S2', `update public.profiles set username = 'sam.tan' where id = $1`, [ids.S2]);
await denied('bad username', 'S2', `update public.profiles set username = 'no spaces!' where id = $1`, [ids.S2]);
await count('anon reads no profiles', 'ANON', `select * from public.profiles`, [], 0);

// ---------- profiles ----------
const meta = await db.query(`select role from public.profiles where id = $1`, [ids.S1]);
check('sign-up metadata cannot grant a role', meta.rows[0].role === 'student');
await denied('student cannot make self teacher', 'S1', `update public.profiles set role = 'teacher' where id = $1`, [ids.S1]);
await ok('student renames self', 'S1', `update public.profiles set full_name = 'Sam' where id = $1`, [ids.S1]);
await denied('student cannot rename others', 'S1', `update public.profiles set full_name = 'x' where id = $1`, [ids.S2]);
await ok('admin promotes', 'A', `update public.profiles set role = 'student' where id = $1`, [ids.S3]);

// ---------- classes ----------
await denied('student cannot create class', 'S1', `insert into public.classes (name) values ('Hack')`);
const cls = await ok('teacher creates class', 'T', `insert into public.classes (name, subject) values ('Maths 10A', 'Maths') returning id, join_code`);
if (!cls) {
  console.log(failures);
  process.exit(1);
}
const classId = cls.rows[0].id;
const code = cls.rows[0].join_code;
check('join code is 6 chars', /^[0-9A-F]{6}$/.test(code));
await denied('teacher cannot create class for someone else', 'T2', `insert into public.classes (name, teacher_id) values ('x', $1)`, [ids.T]);
await denied('wrong code fails', 'S1', `select public.join_class('ZZZZZZ')`);
await ok('student joins with code', 'S1', `select public.join_class($1)`, [code.toLowerCase()]);
await ok('second student joins', 'S2', `select public.join_class($1)`, [code]);
await count('member sees class', 'S1', `select * from public.classes`, [], 1);
await count('outsider sees no class', 'S3', `select * from public.classes`, [], 0);
await count('other teacher sees no class', 'T2', `select * from public.classes`, [], 0);
await count('admin sees class', 'A', `select * from public.classes`, [], 1);
await count('classmates visible', 'S1', `select * from public.class_members`, [], 2);
await denied('student cannot add others', 'S1', `insert into public.class_members (class_id, user_id) values ($1, $2)`, [classId, ids.S3]);
await denied('student cannot rename class', 'S1', `update public.classes set name = 'x' where id = $1`, [classId]);

// ---------- announcements ----------
await ok('teacher posts school-wide', 'T', `insert into public.announcements (title, body) values ('Sports day', 'Bring water')`);
await denied('student cannot post', 'S1', `insert into public.announcements (title, body) values ('x', 'y')`);
await ok('teacher posts to own class', 'T', `insert into public.announcements (class_id, title, body) values ($1, 'Quiz', 'Friday')`, [classId]);
await denied('other teacher cannot post to class', 'T2', `insert into public.announcements (class_id, title, body) values ($1, 'x', 'y')`, [classId]);
await denied('cannot post as someone else', 'T2', `insert into public.announcements (title, body, author_id) values ('x', 'y', $1)`, [ids.T]);
await count('outsider sees school-wide only', 'S3', `select * from public.announcements`, [], 1);
await count('member sees both', 'S1', `select * from public.announcements`, [], 2);
await denied('other teacher cannot edit', 'T2', `update public.announcements set title = 'x'`);
await denied('teacher cannot move post to a class they do not teach', 'T2',
  `update public.announcements set class_id = $1`, [classId]);

// ---------- assignments + submissions ----------
const asg = await ok('teacher sets assignment', 'T', `insert into public.assignments (class_id, title) values ($1, 'Homework 1') returning id`, [classId]);
const asgId = asg.rows[0].id;
await denied('student cannot set assignment', 'S1', `insert into public.assignments (class_id, title) values ($1, 'x')`, [classId]);
await count('member sees assignment', 'S1', `select * from public.assignments`, [], 1);
await count('outsider sees no assignment', 'S3', `select * from public.assignments`, [], 0);
const sub = await ok('student hands in (self-grade ignored)', 'S1',
  `insert into public.submissions (assignment_id, body, grade) values ($1, 'my work', 'A+') returning grade`, [asgId]);
check('self-grade stripped', sub && sub.rows[0].grade === null);
await denied('outsider cannot hand in', 'S3', `insert into public.submissions (assignment_id, body) values ($1, 'x')`, [asgId]);
await denied('cannot hand in for someone else', 'S2', `insert into public.submissions (assignment_id, student_id, body) values ($1, $2, 'x')`, [asgId, ids.S1]);
await count('classmate cannot see submission', 'S2', `select * from public.submissions`, [], 0);
await count('teacher sees submission', 'T', `select * from public.submissions`, [], 1);
await ok('teacher grades', 'T', `update public.submissions set grade = 'B', feedback = 'Good', body = 'teacher edit'`);
const graded = await db.query(`select body, grade, graded_at from public.submissions`);
check('teacher grade saved, body kept', graded.rows[0].grade === 'B' && graded.rows[0].body === 'my work' && graded.rows[0].graded_at);
await ok('student resubmits', 'S1', `update public.submissions set body = 'v2', grade = 'A' where student_id = $1`, [ids.S1]);
const after = await db.query(`select body, grade from public.submissions`);
check('student cannot change grade', after.rows[0].grade === 'B' && after.rows[0].body === 'v2');
await denied('graded work cannot be withdrawn', 'S1', `delete from public.submissions where student_id = $1`, [ids.S1]);

// ---------- materials ----------
await ok('teacher adds material', 'T', `insert into public.materials (class_id, title, link_url) values ($1, 'Slides', 'https://example.com')`, [classId]);
await denied('bad link rejected', 'T', `insert into public.materials (class_id, title, link_url) values ($1, 'x', 'javascript:alert(1)')`, [classId]);
await denied('student cannot add material', 'S1', `insert into public.materials (class_id, title) values ($1, 'x')`, [classId]);
await count('member sees material', 'S1', `select * from public.materials`, [], 1);

// ---------- attendance ----------
await ok('teacher marks member', 'T', `insert into public.attendance (class_id, student_id, on_date, status) values ($1, $2, '2026-11-03', 'present')`, [classId, ids.S1]);
await ok('teacher marks second member', 'T', `insert into public.attendance (class_id, student_id, on_date, status) values ($1, $2, '2026-11-03', 'late')`, [classId, ids.S2]);
await denied('teacher cannot mark non-member', 'T', `insert into public.attendance (class_id, student_id, on_date, status) values ($1, $2, '2026-11-03', 'absent')`, [classId, ids.S3]);
await denied('student cannot mark', 'S1', `insert into public.attendance (class_id, student_id, on_date, status) values ($1, $2, '2026-11-04', 'present')`, [classId, ids.S1]);
await count('student sees own attendance only', 'S1', `select * from public.attendance`, [], 1);
await count('teacher sees class attendance', 'T', `select * from public.attendance`, [], 2);
await ok('teacher upserts', 'T', `insert into public.attendance (class_id, student_id, on_date, status) values ($1, $2, '2026-11-03', 'absent')
  on conflict (class_id, student_id, on_date) do update set status = excluded.status`, [classId, ids.S1]);

// ---------- reports ----------
await ok('teacher drafts report', 'T', `insert into public.reports (student_id, class_id, term, grade, comment) values ($1, $2, 'Term 1', 'A', 'Great')`, [ids.S1, classId]);
await denied('report for non-member', 'T', `insert into public.reports (student_id, class_id, term) values ($1, $2, 'Term 1')`, [ids.S3, classId]);
await count('draft hidden from student', 'S1', `select * from public.reports`, [], 0);
await ok('teacher publishes', 'T', `update public.reports set published = true`);
await count('student sees published', 'S1', `select * from public.reports`, [], 1);
await count('classmate sees none', 'S2', `select * from public.reports`, [], 0);
await denied('student cannot edit report', 'S1', `update public.reports set grade = 'A+'`);

// ---------- messages ----------
await ok('student messages classmate', 'S1', `insert into public.messages (recipient_id, body) values ($1, 'hi')`, [ids.S2]);
await denied('cannot send as someone else', 'S1', `insert into public.messages (sender_id, recipient_id, body) values ($1, $2, 'x')`, [ids.S2, ids.S3]);
await denied('cannot message self', 'S1', `insert into public.messages (recipient_id, body) values ($1, 'x')`, [ids.S1]);
await count('recipient reads', 'S2', `select * from public.messages`, [], 1);
await count('others cannot read', 'S3', `select * from public.messages`, [], 0);
await denied('recipient cannot edit', 'S2', `update public.messages set body = 'x'`);

// ---------- events, timetable, activities ----------
await denied('student cannot add event', 'S1', `insert into public.events (title, starts_on) values ('x', '2026-12-01')`);
await ok('teacher adds event', 'T', `insert into public.events (title, starts_on, category) values ('Exams', '2026-12-01', 'exam')`);
await count('everyone sees events', 'S3', `select * from public.events`, [], 1);
await ok('teacher adds slot', 'T', `insert into public.timetable_slots (class_id, weekday, starts_at, ends_at, room) values ($1, 1, '09:00', '10:00', 'B2')`, [classId]);
await denied('end before start', 'T', `insert into public.timetable_slots (class_id, weekday, starts_at, ends_at) values ($1, 1, '10:00', '09:00')`, [classId]);
await count('member sees slot', 'S1', `select * from public.timetable_slots`, [], 1);
await count('outsider sees no slot', 'S3', `select * from public.timetable_slots`, [], 0);
const act = await ok('teacher creates activity', 'T', `insert into public.activities (name, meets) values ('Robotics', 'Tue 3pm') returning id`);
const actId = act.rows[0].id;
await denied('student cannot create activity', 'S1', `insert into public.activities (name) values ('x')`);
await ok('student joins activity', 'S1', `insert into public.activity_members (activity_id, user_id) values ($1, $2)`, [actId, ids.S1]);
await denied('student cannot add others', 'S1', `insert into public.activity_members (activity_id, user_id) values ($1, $2)`, [actId, ids.S2]);
await denied('student cannot remove others', 'S2', `delete from public.activity_members where user_id = $1`, [ids.S1]);
await ok('leader removes member', 'T', `delete from public.activity_members where user_id = $1`, [ids.S1]);

// ---------- storage ----------
const mat = `${classId}/materials/slides.pdf`;
const mine = `${classId}/submissions/${ids.S1}/work.pdf`;
await denied('student cannot upload material', 'S1', `insert into storage.objects (bucket_id, name) values ('class-files', $1)`, [mat]);
await ok('teacher uploads material', 'T', `insert into storage.objects (bucket_id, name) values ('class-files', $1)`, [mat]);
await ok('student uploads own submission', 'S1', `insert into storage.objects (bucket_id, name) values ('class-files', $1)`, [mine]);
await denied('student cannot upload into another student folder', 'S2', `insert into storage.objects (bucket_id, name) values ('class-files', $1)`, [mine]);
await denied('outsider cannot upload', 'S3', `insert into storage.objects (bucket_id, name) values ('class-files', $1)`, [`${classId}/submissions/${ids.S3}/x.pdf`]);
await denied('bad path rejected', 'T', `insert into storage.objects (bucket_id, name) values ('class-files', 'not-a-uuid/materials/x')`);
await count('student sees material + own work', 'S1', `select name from storage.objects`, [], 2);
await count('classmate sees material only', 'S2', `select name from storage.objects`, [], 1);
await count('outsider sees nothing', 'S3', `select name from storage.objects`, [], 0);
await count('teacher sees all', 'T', `select name from storage.objects`, [], 2);

// ---------- helper functions locked to signed-in users ----------
await denied('anon cannot call assignment_class', 'ANON', `select public.assignment_class($1)`, [asgId]);
await denied('anon cannot call in_class', 'ANON', `select public.in_class($1)`, [classId]);
await ok('signed-in user can call in_class', 'S1', `select public.in_class($1)`, [classId]);
const bucket = await db.query(`select allowed_mime_types from storage.buckets where id = 'class-files'`);
check('bucket has a file-type list', (bucket.rows[0]?.allowed_mime_types ?? []).includes('application/pdf'));

// ---------- Admin page (passkey) and teacher invite codes ----------
const PK = 'correct-horse-battery-staple';
const st = async (who, key) => (await as(who, `select public.admin_status($1) as s`, [key])).rows[0].s;
check('admin: unset before the passkey is set', (await st('ANON', PK)) === 'unset');
await db.query(`insert into public.admin_settings (passkey_salt, passkey_hash) values ('s4lt', encode(extensions.digest('s4lt' || $1, 'sha256'), 'hex'))`, [PK]);
check('admin: right passkey', (await st('ANON', PK)) === 'ok');
check('admin: wrong passkey', (await st('ANON', 'nope')) === 'wrong');
await denied('admin: nobody reads the passkey table', 'ANON', `select * from public.admin_settings`);
await denied('admin: nobody reads invites directly', 'S1', `select * from public.teacher_invites`);
await denied('admin: admin_check not callable', 'ANON', `select public.admin_check($1)`, [PK]);
const people = await ok('admin: list people', 'ANON', `select * from public.admin_people($1, '')`, [PK]);
check('admin: people include emails', people && people.rows.some((r) => r.email === 's2@school.test'));
await count('admin: wrong passkey lists nobody', 'ANON', `select * from public.admin_people($1, '')`, ['nope'], 0);
const setRole = await ok('admin: set role', 'S1', `select public.admin_set_role($1, $2, 'teacher') as s`, [PK, ids.S3]);
check('admin: role change ok', setRole && setRole.rows[0].s === 'ok');
const r3 = await db.query(`select role from public.profiles where id = $1`, [ids.S3]);
check('admin: S3 is now a teacher', r3.rows[0].role === 'teacher');
const badRole = await ok('admin: no admin role', 'ANON', `select public.admin_set_role($1, $2, 'admin') as s`, [PK, ids.S3]);
check('admin: admin role refused', badRole && badRole.rows[0].s === 'bad-role');
const noKey = await ok('admin: set role without passkey', 'ANON', `select public.admin_set_role('nope', $1, 'student') as s`, [ids.S3]);
check('admin: no change without passkey', noKey && noKey.rows[0].s === 'wrong');
await denied('admin: student still cannot self-promote', 'S2', `update public.profiles set role = 'teacher' where id = $1`, [ids.S2]);
await db.query(`delete from public.admin_attempts`);

// Schools (name only), admin-made teachers, school on sign-up.
const st1 = await ok('school: add', 'ANON', `select public.admin_save_school($1, null, 'Green Hill School') as s`, [PK]);
check('school: added', st1 && st1.rows[0].s === 'ok');
const dup = await ok('school: duplicate', 'ANON', `select public.admin_save_school($1, null, ' green hill school ') as s`, [PK]);
check('school: duplicate refused', dup && dup.rows[0].s === 'duplicate');
check('school: no add without passkey', (await as('ANON', `select public.admin_save_school('nope', null, 'X School') as s`)).rows[0].s === 'wrong');
const schools = await ok('school: anyone reads names (sign-up list)', 'ANON', `select id, name from public.schools`);
const schoolId = schools.rows[0].id;
check('school: one school', schools.rows.length === 1);
await denied('school: nobody adds directly', 'S1', `insert into public.schools (name) values ('Hack School')`);
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000a1', 'new.student@school.test', $1)`, [{ full_name: 'New Student', school_id: schoolId, role: 'teacher' }]);
const ns = await db.query(`select role, school_id from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'`);
check('signup: student with school, role ignored', ns.rows[0].role === 'student' && ns.rows[0].school_id === schoolId);
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000a4', 'bad.school@school.test', $1)`, [{ school_id: 'not-a-uuid' }]);
const bs = await db.query(`select school_id from public.profiles where id = '00000000-0000-0000-0000-0000000000a4'`);
check('signup: bad school id ignored', bs.rows[0].school_id === null);
const prep = await ok('teacher: prepare', 'ANON', `select public.admin_prepare_teacher($1, ' Park@School.test ', 'Mr Park', $2) as s`, [PK, schoolId]);
check('teacher: prepared', prep && prep.rows[0].s === 'ok');
check('teacher: bad email refused', (await as('ANON', `select public.admin_prepare_teacher($1, 'nope', '', null) as s`, [PK])).rows[0].s === 'bad-email');
check('teacher: no prepare without passkey', (await as('ANON', `select public.admin_prepare_teacher('nope', 'a@b.co', '', null) as s`)).rows[0].s === 'wrong');
await denied('teacher: nobody reads the teacher list', 'ANON', `select * from public.teacher_emails`);
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000a2', 'park@school.test', '{}')`);
const park = await db.query(`select role, full_name, school_id from public.profiles where id = '00000000-0000-0000-0000-0000000000a2'`);
check('teacher: account becomes a teacher with name and school', park.rows[0].role === 'teacher' && park.rows[0].full_name === 'Mr Park' && park.rows[0].school_id === schoolId);
const ex = await ok('teacher: existing account', 'ANON', `select public.admin_prepare_teacher($1, 's30@other.test', 'Kim', $2) as s`, [PK, schoolId]);
check('teacher: unknown existing email is prepared', ex && ex.rows[0].s === 'ok');
const ex2 = await ok('teacher: promote existing', 'ANON', `select public.admin_prepare_teacher($1, 'a4@school.test', '', null) as s`, [PK]);
check('teacher: not-yet account prepared', ex2 && ex2.rows[0].s === 'ok');
const ex3 = await ok('teacher: existing user', 'ANON', `select public.admin_prepare_teacher($1, 'bad.school@school.test', 'Ms Bad', $2) as s`, [PK, schoolId]);
check('teacher: existing account made teacher now', ex3 && ex3.rows[0].s === 'existing');
const bsr = await db.query(`select role, school_id from public.profiles where id = '00000000-0000-0000-0000-0000000000a4'`);
check('teacher: existing account role and school set', bsr.rows[0].role === 'teacher' && bsr.rows[0].school_id === schoolId);
const ppl = await ok('admin: people with school', 'ANON', `select * from public.admin_people($1, 'green hill')`, [PK]);
check('admin: search by school name', ppl && ppl.rows.length >= 2 && ppl.rows.every((r) => r.school_name === 'Green Hill School'));
const ss = await ok('admin: set school', 'ANON', `select public.admin_set_school($1, $2, $3) as s`, [PK, ids.S1, schoolId]);
check('admin: school set', ss && ss.rows[0].s === 'ok');
await ok('student changes own school', 'S2', `update public.profiles set school_id = $1 where id = $2`, [schoolId, ids.S2]);
const sch = await ok('admin: schools list with counts', 'ANON', `select * from public.admin_schools($1)`, [PK]);
check('admin: school counts', sch && Number(sch.rows[0].students) >= 2 && Number(sch.rows[0].teachers) >= 2);
check('invite codes are gone', (await db.query(`select count(*)::int n from pg_proc where proname in ('check_teacher_code','admin_create_invite')`)).rows[0].n === 0);

// Merits
await ok('merit: teacher gives one', 'T', `insert into public.merits (student_id, class_id, points, reason) values ($1, $2, 2, 'Helped a classmate')`, [ids.S1, classId]);
await ok('merit: teacher gives a demerit', 'T', `insert into public.merits (student_id, class_id, points, reason) values ($1, $2, -1, 'Late homework')`, [ids.S1, classId]);
await denied('merit: zero points refused', 'T', `insert into public.merits (student_id, class_id, points, reason) values ($1, $2, 0, 'x')`, [ids.S1, classId]);
await denied('merit: student cannot give', 'S2', `insert into public.merits (student_id, class_id, points, reason) values ($1, $2, 5, 'x')`, [ids.S1, classId]);
await denied('merit: other teacher cannot give', 'T2', `insert into public.merits (student_id, class_id, points, reason) values ($1, $2, 1, 'x')`, [ids.S1, classId]);
await denied('merit: not to a non-member', 'T', `insert into public.merits (student_id, class_id, points, reason) values ($1, $2, 1, 'x')`, [ids.S3, classId]);
await denied('merit: cannot give as someone else', 'T', `insert into public.merits (student_id, class_id, points, reason, given_by) values ($1, $2, 1, 'x', $3)`, [ids.S1, classId, ids.T2]);
await count('merit: student sees own', 'S1', `select * from public.merits`, [], 2);
await count('merit: classmate sees none', 'S2', `select * from public.merits`, [], 0);
await count('merit: other teacher sees none', 'T2', `select * from public.merits`, [], 0);
await count('merit: class teacher sees them', 'T', `select * from public.merits`, [], 2);
await denied('merit: student cannot remove', 'S1', `delete from public.merits`);
await ok('merit: giver removes', 'T', `delete from public.merits where points < 0`);
await count('merit: one left', 'S1', `select * from public.merits`, [], 1);

// Merits: edit by the giver only, optional details.
await ok('merit edit: giver changes points, reason, details', 'T',
  `update public.merits set points = 3, reason = 'Helped two classmates', details = '  Stayed after class to explain fractions.  ' where student_id = $1`, [ids.S1]);
const edited = await db.query(`select points, reason, details, updated_at from public.merits where student_id = $1`, [ids.S1]);
check('merit edit: saved, details trimmed, edit time set', edited.rows[0].points === 3 && edited.rows[0].details === 'Stayed after class to explain fractions.' && edited.rows[0].updated_at !== null);
await ok('merit edit: empty details become none', 'T', `update public.merits set details = '   ' where student_id = $1`, [ids.S1]);
check('merit edit: blank details cleared', (await db.query(`select details from public.merits where student_id = $1`, [ids.S1])).rows[0].details === null);
await denied('merit edit: other teacher cannot', 'T2', `update public.merits set reason = 'x'`);
await denied('merit edit: student cannot', 'S1', `update public.merits set points = 10`);
await denied('merit edit: cannot move it to another student', 'T', `update public.merits set student_id = $1`, [ids.S2]);
await denied('merit edit: cannot change who gave it', 'T', `update public.merits set given_by = $1`, [ids.T2]);
await denied('merit edit: zero points refused', 'T', `update public.merits set points = 0`);
await denied('merit edit: details over 1000 characters refused', 'T', `update public.merits set details = repeat('a', 1001)`);
await ok('merit: give with details', 'T', `insert into public.merits (student_id, class_id, points, reason, details) values ($1, $2, 1, 'Tidy work', 'Neat diagrams all week.')`, [ids.S1, classId]);

// Same school: join, teacher add and merits.
const schoolB = (await db.query(`insert into public.schools (name) values ('Riverside Academy') returning id`)).rows[0].id;
await db.query(`update public.profiles set school_id = $1 where id = any($2)`, [schoolId, [ids.T, ids.S1, ids.S2]]);
await db.query(`update public.profiles set school_id = $1 where id = $2`, [schoolB, ids.S3]);
await denied('same school: student from another school cannot join', 'S3', `select public.join_class($1)`, [code]);
await denied('same school: teacher cannot add a student from another school', 'T', `insert into public.class_members (class_id, user_id) values ($1, $2)`, [classId, ids.S3]);
await ok('same school: same-school student gets a merit', 'T', `insert into public.merits (student_id, class_id, points, reason) values ($1, $2, 1, 'Good question')`, [ids.S2, classId]);
await db.query(`update public.profiles set school_id = $1 where id = $2`, [schoolB, ids.S2]);
await denied('same school: no merit once the student is at another school', 'T', `insert into public.merits (student_id, class_id, points, reason) values ($1, $2, 1, 'x')`, [ids.S2, classId]);
await db.query(`update public.profiles set school_id = null where id = $1`, [ids.S3]);
await ok('same school: no school set yet is allowed to join', 'S3', `select public.join_class($1)`, [code]);
await ok('same school: leaves again', 'S3', `delete from public.class_members where class_id = $1 and user_id = $2`, [classId, ids.S3]);
check('same school: not callable signed out', !!(await as('ANON', `select public.same_school($1, $2)`, [ids.T, ids.S1]).then(() => false, () => true)));
await db.query(`update public.profiles set school_id = null where id = any($1)`, [[ids.T, ids.S1, ids.S2, ids.S3]]);
await db.query(`delete from public.merits where student_id = $1`, [ids.S2]);

const cls2 = await ok('admin: classes', 'ANON', `select * from public.admin_classes($1)`, [PK]);
check('admin: class with student count', cls2 && cls2.rows.some((r) => r.id === classId && Number(r.students) === 2));
const mem = await ok('admin: class members', 'ANON', `select * from public.admin_class_members($1, $2)`, [PK, classId]);
check('admin: members listed', mem && mem.rows.length === 2);
const rm = await ok('admin: remove member', 'ANON', `select public.admin_remove_member($1, $2, $3) as s`, [PK, classId, ids.S2]);
check('admin: member removed', rm && rm.rows[0].s === 'ok');

// Admin password reset (no email needed).
const s2name = (await db.query(`select username from public.profiles where id = $1`, [ids.S2])).rows[0].username;
for (let i = 0; i < 10; i++) await db.query(`insert into public.sign_in_attempts (username) values ($1)`, [s2name]);
const signInAs = (pw) => as('ANON', `select public.email_for_sign_in($1, $2) as e`, [s2name, pw]).then((r) => r.rows[0].e, (e) => (/too many/i.test(e.message) ? 'locked' : 'error'));
check('reset: locked-out user cannot sign in first', (await signInAs('pass-S2')) === 'locked');
const rp = async (who, key, target, pw) => (await as(who, `select public.admin_reset_password($1, $2, $3) as s`, [key, target, pw])).rows[0].s;
check('reset: wrong passkey refused', (await rp('ANON', 'nope', ids.S2, 'Brand-new-pass-1')) === 'wrong');
check('reset: signed-in student without passkey refused', (await rp('S1', 'nope', ids.S2, 'Brand-new-pass-1')) === 'wrong');
check('reset: short password refused', (await rp('ANON', PK, ids.S2, 'short')) === 'weak');
check('reset: unknown person', (await rp('ANON', PK, '00000000-0000-0000-0000-0000000000ff', 'Brand-new-pass-1')) === 'not-found');
check('reset: done with passkey', (await rp('ANON', PK, ids.S2, 'Brand-new-pass-1')) === 'ok');
check('reset: new password signs in (lock cleared)', (await signInAs('Brand-new-pass-1')) === 's2@school.test');
check('reset: old password no longer works', (await signInAs('pass-S2')) === null);
check('reset: not callable with a direct table write', !!(await as('S1', `update auth.users set encrypted_password = 'x' where id = $1`, [ids.S2]).then((r) => r.affectedRows > 0 ? false : true, () => true)));

for (let i = 0; i < 10; i++) await as('ANON', `select public.admin_status('wrong-${i}')`);
check('admin: locked after 10 wrong passkeys, even the right one', (await st('ANON', PK)) === 'locked');

console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log('FAIL ' + f);
process.exit(failures.length ? 1 : 0);
