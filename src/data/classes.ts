import { supabase, unwrap } from '../lib/supabase';
import { removeFolder } from './files';
import type { ClassMember, ClassRoom } from './types';

// "!classes_teacher_id_fkey" picks the teacher link (classes also reach profiles via class_members).
const CLASS_FIELDS = '*, teacher:profiles!classes_teacher_id_fkey(full_name)';

// Row Level Security only returns classes you teach or have joined.
export async function listMyClasses(): Promise<ClassRoom[]> {
  return unwrap(await supabase.from('classes').select(CLASS_FIELDS).order('name'));
}

export async function getClass(id: string): Promise<ClassRoom | null> {
  return unwrap(await supabase.from('classes').select(CLASS_FIELDS).eq('id', id).maybeSingle());
}

export async function createClass({ name, subject }: { name: string; subject: string }): Promise<ClassRoom> {
  return unwrap(
    await supabase
      .from('classes')
      .insert({ name: name.trim(), subject: subject.trim() || null })
      .select(CLASS_FIELDS)
      .single(),
  );
}

export async function updateClass(id: string, changes: { name: string; subject: string }) {
  unwrap(
    await supabase
      .from('classes')
      .update({ name: changes.name.trim(), subject: changes.subject.trim() || null })
      .eq('id', id),
  );
}

// Removes the class's files (materials and handed-in work) first, then the class itself.
export async function deleteClass(id: string) {
  await removeFolder(id);
  unwrap(await supabase.from('classes').delete().eq('id', id));
}

const JOIN_ERRORS: Record<string, string> = {
  'not-found': 'No class has that code. Check it with your teacher.',
  'other-school': 'That class is at another school. Check the code, or ask your school\'s admin to check your school.',
  'too-many': 'Too many wrong codes. Wait 15 minutes and try again.',
};

export async function joinClass(code: string): Promise<string> {
  const result: string = unwrap(await supabase.rpc('join_class', { code: code.trim() }));
  if (JOIN_ERRORS[result]) throw new Error(JOIN_ERRORS[result]);
  return result;
}

export async function listMembers(classId: string): Promise<ClassMember[]> {
  const rows: ClassMember[] = unwrap(
    await supabase
      .from('class_members')
      .select('joined_at, profile:profiles(id, full_name, username, role)')
      .eq('class_id', classId),
  );
  return rows.sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name));
}

export async function removeMember(classId: string, userId: string) {
  unwrap(await supabase.from('class_members').delete().eq('class_id', classId).eq('user_id', userId));
}
