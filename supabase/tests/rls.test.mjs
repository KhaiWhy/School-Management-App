// Checks every access rule in the database, without needing Supabase or Docker:
// runs the migrations on PGlite (Postgres in WebAssembly) with a small Supabase stand-in
// (auth.users, auth.uid(), storage, the anon/authenticated/service_role roles).
// Run: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../migrations/', import.meta.url);
const migration = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(new URL(f, dir), 'utf8'))
  .join(';\n');
const db = new PGlite();

await db.exec(`
  create role authenticated nologin;
  create role anon nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
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
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    ids[key], `${key.toLowerCase()}@school.test`, { full_name: key, role: 'admin' },
  ]);
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
await denied('browser cannot look up emails (signed in)', 'S1', `select public.email_for_username('s2')`);
await denied('browser cannot look up emails (anon)', 'ANON', `select public.email_for_username('s2')`);
const lookup = await ok('server looks up email', 'SERVICE', `select public.email_for_username(' S20 ') as email`);
check('lookup returns the email', lookup && lookup.rows[0].email === 's2@school.test');
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

console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log('FAIL ' + f);
process.exit(failures.length ? 1 : 0);
