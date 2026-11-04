import { supabase, unwrap } from '../lib/supabase';
import type { Merit } from './types';

const FIELDS =
  '*, class:classes(name), giver:profiles!merits_given_by_fkey(full_name), student:profiles!merits_student_id_fkey(full_name, username)';

// Students get their own; teachers get the ones for their classes and the ones they gave.
// classId given: that class only (a teacher's view); otherwise all of yours.
export async function listMerits(classId?: string): Promise<Merit[]> {
  let query = supabase.from('merits').select(FIELDS).order('created_at', { ascending: false }).limit(2000);
  if (classId) query = query.eq('class_id', classId);
  return unwrap(await query);
}

export async function giveMerit(input: { studentId: string; classId: string; points: number; reason: string; details?: string }) {
  unwrap(
    await supabase.from('merits').insert({
      student_id: input.studentId,
      class_id: input.classId,
      points: input.points,
      reason: input.reason.trim(),
      details: input.details?.trim() || null,
    }),
  );
}

// Only the teacher who gave it can change it, and only these three fields (database rule).
export async function updateMerit(id: string, input: { points: number; reason: string; details: string }) {
  unwrap(
    await supabase
      .from('merits')
      .update({ points: input.points, reason: input.reason.trim(), details: input.details.trim() || null })
      .eq('id', id),
  );
}

export async function removeMerit(id: string) {
  unwrap(await supabase.from('merits').delete().eq('id', id));
}
