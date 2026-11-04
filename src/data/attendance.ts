import { supabase, unwrap } from '../lib/supabase';
import type { AttendanceRecord, AttendanceStatus } from './types';

export async function listClassAttendance(classId: string, onDate: string): Promise<AttendanceRecord[]> {
  return unwrap(
    await supabase.from('attendance').select('*').eq('class_id', classId).eq('on_date', onDate),
  );
}

export async function saveAttendance(
  classId: string,
  onDate: string,
  marks: { studentId: string; status: AttendanceStatus }[],
) {
  if (marks.length === 0) return;
  unwrap(
    await supabase.from('attendance').upsert(
      marks.map((m) => ({ class_id: classId, student_id: m.studentId, on_date: onDate, status: m.status })),
      { onConflict: 'class_id,student_id,on_date' },
    ),
  );
}

// A student's own record (Row Level Security hides everyone else's).
export async function listMyAttendance(studentId: string): Promise<AttendanceRecord[]> {
  return unwrap(
    await supabase
      .from('attendance')
      .select('*, class:classes(name)')
      .eq('student_id', studentId)
      .order('on_date', { ascending: false })
      .limit(100),
  );
}

// Totals over all of a student's record (counted in the database, not just the recent rows).
export async function myAttendanceTotals(): Promise<Record<string, number>> {
  const rows: { status: string; n: number }[] = unwrap(await supabase.rpc('my_attendance_totals'));
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}
