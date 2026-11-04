import { createClient } from '@supabase/supabase-js';
import { publishableKey, supabase, unwrap, url } from '../lib/supabase';

// The /admin page. Every call sends the passkey; the database checks it each time
// (supabase/migrations/20261104000000_admin_passkey.sql and _schools_teachers_merits.sql).
// Nothing here needs an account.

export interface AdminPerson {
  id: string;
  full_name: string;
  username: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  school_id: string | null;
  school_name: string | null;
  created_at: string;
}

export interface AdminSchool {
  id: string;
  name: string;
  students: number;
  teachers: number;
  created_at: string;
}

export interface AdminClass {
  id: string;
  name: string;
  subject: string | null;
  teacher_name: string;
  join_code: string;
  students: number;
  created_at: string;
}

const MESSAGES: Record<string, string> = {
  wrong: 'Wrong passkey.',
  locked: 'Too many wrong passkeys. The admin page is locked for 15 minutes.',
  unset: 'The admin passkey has not been set yet (npm run admin:set-passkey).',
  'bad-role': 'That role is not allowed.',
  'bad-email': "That email doesn't look right.",
  'bad-name': 'School names need 2 to 120 characters.',
  duplicate: 'A school with that name already exists.',
  'not-found': 'That was already changed or removed. Refresh and try again.',
  weak: 'The new password is too short.',
};

function fail(status: string): never {
  throw new Error(MESSAGES[status] ?? `Something went wrong (${status}).`);
}

export async function checkPasskey(passkey: string): Promise<void> {
  const status: string = unwrap(await supabase.rpc('admin_status', { passkey }));
  if (status !== 'ok') fail(status);
}

// Lists come back empty on a wrong passkey, so check first to say why.
async function list<T>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  await checkPasskey(args.passkey as string);
  return unwrap(await supabase.rpc(fn, args)) ?? [];
}

async function act(fn: string, args: Record<string, unknown>) {
  const status: string = unwrap(await supabase.rpc(fn, args));
  if (status !== 'ok') fail(status);
}

// ---------- People ----------

export const listPeople = (passkey: string, search: string) =>
  list<AdminPerson>('admin_people', { passkey, search });

export const setRole = (passkey: string, target: string, role: 'student' | 'teacher') =>
  act('admin_set_role', { passkey, target, new_role: role });

export const setSchool = (passkey: string, target: string, school: string | null) =>
  act('admin_set_school', { passkey, target, school });

// New one-time password for anyone, no email needed. It signs them out everywhere and clears
// any wrong-password lock; they sign in with it and change it on their Profile.
export async function resetPassword(passkey: string, target: string): Promise<string> {
  const password = onetimePassword();
  await act('admin_reset_password', { passkey, target, new_password: password });
  return password;
}

// ---------- Schools ----------

export const listSchools = (passkey: string) => list<AdminSchool>('admin_schools', { passkey });

export const saveSchool = (passkey: string, school: string | null, name: string) =>
  act('admin_save_school', { passkey, school, school_name: name });

export const deleteSchool = (passkey: string, school: string) => act('admin_delete_school', { passkey, school });

// ---------- Teachers ----------

// A one-time password the admin passes on; the teacher changes it on their Profile page.
function onetimePassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5, 10)}-${chars.slice(10)}`;
}

// Makes a teacher account: the database first notes the email as a teacher, then the account
// is created with a one-time password. If the email already has an account, it simply
// becomes a teacher (no password is made). Uses a separate client so the admin's own
// browser sign-in (if any) isn't touched.
export async function createTeacher(
  passkey: string,
  input: { email: string; name: string; schoolId: string | null },
): Promise<{ existing: boolean; password: string }> {
  const email = input.email.trim().toLowerCase();
  const password = onetimePassword();
  // An email that already has an account becomes a teacher with this new password, so
  // whoever made that account can't keep using it.
  const status: string = unwrap(
    await supabase.rpc('admin_prepare_teacher', {
      passkey,
      teacher_email: email,
      teacher_name: input.name.trim(),
      school: input.schoolId,
      new_password: password,
    }),
  );
  if (status === 'existing') return { existing: true, password };
  if (status !== 'ok') fail(status);
  const side = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'schooling-admin-create' },
  });
  unwrap(await side.auth.signUp({ email, password, options: { data: { full_name: input.name.trim() } } }));
  await side.auth.signOut({ scope: 'local' });
  return { existing: false, password };
}

// ---------- Classes ----------

export const listClasses = (passkey: string) => list<AdminClass>('admin_classes', { passkey });

export const listClassMembers = (passkey: string, classId: string) =>
  list<{ id: string; full_name: string; username: string }>('admin_class_members', { passkey, class: classId });

export const removeMember = (passkey: string, classId: string, member: string) =>
  act('admin_remove_member', { passkey, class: classId, member });
