import { supabase, unwrap } from '../lib/supabase';
import { removeClassFile, uploadClassFile } from './files';
import type { Assignment, Material, Submission } from './types';

// ---------- Assignments ----------

const ASSIGNMENT_FIELDS = '*, class:classes(name, teacher_id)';

// Newest due date first (no due date at the top); `limit` grows with "Show older".
export async function listAssignments(classId?: string, limit = 100): Promise<Assignment[]> {
  let query = supabase
    .from('assignments')
    .select(ASSIGNMENT_FIELDS)
    .order('due_at', { ascending: false, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (classId) query = query.eq('class_id', classId);
  return unwrap(await query);
}

// What's due from now on, soonest first.
export async function listUpcomingAssignments(limit = 20): Promise<Assignment[]> {
  return unwrap(
    await supabase
      .from('assignments')
      .select(ASSIGNMENT_FIELDS)
      .gte('due_at', new Date().toISOString())
      .order('due_at', { ascending: true })
      .limit(limit),
  );
}

export async function listAssignmentsByIds(ids: string[]): Promise<Assignment[]> {
  if (ids.length === 0) return [];
  return unwrap(await supabase.from('assignments').select(ASSIGNMENT_FIELDS).in('id', ids.slice(0, 100)));
}

export async function getAssignment(id: string): Promise<Assignment | null> {
  return unwrap(await supabase.from('assignments').select(ASSIGNMENT_FIELDS).eq('id', id).maybeSingle());
}

export async function createAssignment(input: {
  classId: string;
  title: string;
  description: string;
  dueAt: string | null;
}) {
  unwrap(
    await supabase.from('assignments').insert({
      class_id: input.classId,
      title: input.title.trim(),
      description: input.description.trim(),
      due_at: input.dueAt,
    }),
  );
}

export async function deleteAssignment(id: string) {
  unwrap(await supabase.from('assignments').delete().eq('id', id));
}

// ---------- Submissions ----------

// Everything handed in for one assignment (a teacher sees the class; a student their own).
export async function listSubmissions(assignmentId: string): Promise<Submission[]> {
  return unwrap(
    await supabase
      .from('submissions')
      .select('*, student:profiles!submissions_student_id_fkey(full_name, username)')
      .eq('assignment_id', assignmentId)
      .order('submitted_at', { ascending: false }),
  );
}

// A student's own work, for their lists.
export async function listMySubmissions(studentId: string): Promise<Submission[]> {
  return unwrap(
    await supabase.from('submissions').select('*').eq('student_id', studentId).order('submitted_at', { ascending: false }).limit(1000),
  );
}

// Per assignment: how many handed in, how many still to grade (counted in the database).
export async function submissionCounts(): Promise<Map<string, { handedIn: number; toGrade: number }>> {
  const rows: { assignment_id: string; handed_in: number; to_grade: number }[] = unwrap(await supabase.rpc('submission_counts'));
  return new Map(rows.map((r) => [r.assignment_id, { handedIn: Number(r.handed_in), toGrade: Number(r.to_grade) }]));
}

export async function submitWork(input: {
  assignment: Assignment;
  studentId: string;
  body: string;
  file: File | null;
  previous: Submission | null;
}) {
  let file_path = input.previous?.file_path ?? null;
  let file_name = input.previous?.file_name ?? null;
  if (input.file) {
    const uploaded = await uploadClassFile(
      `${input.assignment.class_id}/submissions/${input.studentId}`,
      input.file,
    );
    file_path = uploaded.path;
    file_name = uploaded.name;
  }
  const oldFile = input.previous?.file_path ?? null;
  unwrap(
    await supabase.from('submissions').upsert(
      {
        assignment_id: input.assignment.id,
        student_id: input.studentId,
        body: input.body.trim(),
        file_path,
        file_name,
      },
      { onConflict: 'assignment_id,student_id' },
    ),
  );
  if (oldFile && oldFile !== file_path) await removeClassFile(oldFile);
}

export async function withdrawSubmission(submission: Submission) {
  unwrap(await supabase.from('submissions').delete().eq('id', submission.id));
  if (submission.file_path) await removeClassFile(submission.file_path);
}

export async function gradeSubmission(id: string, grade: string, feedback: string) {
  unwrap(
    await supabase
      .from('submissions')
      .update({ grade: grade.trim() || null, feedback: feedback.trim() || null })
      .eq('id', id),
  );
}

// ---------- Materials ----------

export async function listMaterials(classId?: string): Promise<Material[]> {
  let query = supabase
    .from('materials')
    .select('*, class:classes(name)')
    .order('created_at', { ascending: false })
    .limit(300);
  if (classId) query = query.eq('class_id', classId);
  return unwrap(await query);
}

export async function addMaterial(input: {
  classId: string;
  title: string;
  description: string;
  link: string;
  file: File | null;
}) {
  const uploaded = input.file ? await uploadClassFile(`${input.classId}/materials`, input.file) : null;
  const result = await supabase.from('materials').insert({
    class_id: input.classId,
    title: input.title.trim(),
    description: input.description.trim(),
    link_url: input.link.trim() || null,
    file_path: uploaded?.path ?? null,
    file_name: uploaded?.name ?? null,
  });
  if (result.error && uploaded) await removeClassFile(uploaded.path);
  unwrap(result);
}

export async function deleteMaterial(material: Material) {
  unwrap(await supabase.from('materials').delete().eq('id', material.id));
  if (material.file_path) await removeClassFile(material.file_path);
}
