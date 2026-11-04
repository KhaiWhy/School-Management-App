import { supabase, unwrap } from '../lib/supabase';
import type { Merit } from './types';

const FIELDS =
  '*, class:classes(name), giver:profiles!merits_given_by_fkey(full_name), student:profiles!merits_student_id_fkey(full_name, username)';

// Students get their own; teachers get the ones for their classes and the ones they gave.
export async function listMerits(): Promise<Merit[]> {
  return unwrap(await supabase.from('merits').select(FIELDS).order('created_at', { ascending: false }).limit(300));
}

export async function giveMerit(input: { studentId: string; classId: string; points: number; reason: string }) {
  unwrap(
    await supabase.from('merits').insert({
      student_id: input.studentId,
      class_id: input.classId,
      points: input.points,
      reason: input.reason.trim(),
    }),
  );
}

export async function removeMerit(id: string) {
  unwrap(await supabase.from('merits').delete().eq('id', id));
}
