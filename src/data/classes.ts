import { supabase, unwrap } from '../lib/supabase';
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

export async function deleteClass(id: string) {
  unwrap(await supabase.from('classes').delete().eq('id', id));
}

export async function joinClass(code: string): Promise<string> {
  return unwrap(await supabase.rpc('join_class', { code }));
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
