import { supabase, unwrap } from '../lib/supabase';
import { removeClassFile, uploadClassFile } from './files';
import type { Assignment, Material, Submission } from './types';

// ---------- Assignments ----------

const ASSIGNMENT_FIELDS = '*, class:classes(name, teacher_id)';

export async function listAssignments(classId?: string): Promise<Assignment[]> {
  let query = supabase
    .from('assignments')
    .select(ASSIGNMENT_FIELDS)
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(300);
  if (classId) query = query.eq('class_id', classId);
  return unwrap(await query);
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

// Students only ever get their own rows back; teachers get the whole class.
export async function listSubmissions(assignmentId?: string): Promise<Submission[]> {
  let query = supabase
    .from('submissions')
    .select('*, student:profiles!submissions_student_id_fkey(full_name, username)');
  if (assignmentId) query = query.eq('assignment_id', assignmentId);
  return unwrap(await query);
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
    if (file_path) await removeClassFile(file_path);
    file_path = uploaded.path;
    file_name = uploaded.name;
  }
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
