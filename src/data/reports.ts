import { supabase, unwrap } from '../lib/supabase';
import type { Report } from './types';

export async function listClassReports(classId: string, term: string): Promise<Report[]> {
  return unwrap(
    await supabase.from('reports').select('*').eq('class_id', classId).eq('term', term.trim()),
  );
}

// Students only see their published reports.
export async function listMyReports(studentId: string): Promise<Report[]> {
  return unwrap(
    await supabase
      .from('reports')
      .select('*, class:classes(name)')
      .eq('student_id', studentId)
      .order('updated_at', { ascending: false }),
  );
}

export async function saveReport(input: {
  studentId: string;
  classId: string;
  term: string;
  grade: string;
  comment: string;
  published: boolean;
}) {
  unwrap(
    await supabase.from('reports').upsert(
      {
        student_id: input.studentId,
        class_id: input.classId,
        term: input.term.trim(),
        grade: input.grade.trim(),
        comment: input.comment.trim(),
        published: input.published,
      },
      { onConflict: 'student_id,class_id,term' },
    ),
  );
}
