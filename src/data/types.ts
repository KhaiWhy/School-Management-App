// Shapes of the rows in the Supabase tables (supabase/migrations/*.sql).

export type Role = 'student' | 'teacher' | 'admin';

export interface Profile {
  id: string;
  full_name: string;
  username: string;
  role: Role;
  school_id: string | null;
  created_at: string;
}

export interface School {
  id: string;
  name: string;
}

export interface Merit {
  id: string;
  student_id: string;
  class_id: string | null;
  points: number;
  reason: string;
  details: string | null;
  given_by: string;
  created_at: string;
  updated_at: string | null;
  class?: { name: string } | null;
  giver?: { full_name: string } | null;
  student?: { full_name: string; username: string } | null;
}

export type PersonRef = Pick<Profile, 'id' | 'full_name' | 'username'>;

export interface ClassRoom {
  id: string;
  name: string;
  subject: string | null;
  teacher_id: string;
  join_code: string;
  created_at: string;
  teacher?: { full_name: string } | null;
}

export interface ClassMember {
  joined_at: string;
  profile: Pick<Profile, 'id' | 'full_name' | 'username' | 'role'>;
}

export interface Announcement {
  id: string;
  class_id: string | null;
  title: string;
  body: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  author?: { full_name: string } | null;
}

export interface Assignment {
  id: string;
  class_id: string;
  title: string;
  description: string;
  due_at: string | null;
  created_by: string;
  created_at: string;
  class?: { name: string; teacher_id: string } | null;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  body: string;
  file_path: string | null;
  file_name: string | null;
  submitted_at: string;
  grade: string | null;
  feedback: string | null;
  graded_at: string | null;
  student?: { full_name: string; username: string } | null;
}

export interface Material {
  id: string;
  class_id: string;
  title: string;
  description: string;
  file_path: string | null;
  file_name: string | null;
  link_url: string | null;
  uploaded_by: string;
  created_at: string;
  class?: { name: string } | null;
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

export interface AttendanceRecord {
  id: string;
  class_id: string;
  student_id: string;
  on_date: string;
  status: AttendanceStatus;
  note: string | null;
  class?: { name: string } | null;
}

export interface TimetableSlot {
  id: string;
  class_id: string;
  weekday: number; // 1 = Monday … 7 = Sunday
  starts_at: string; // "09:00:00"
  ends_at: string;
  room: string | null;
  class?: { name: string; teacher_id: string } | null;
}

export type EventCategory = 'term' | 'holiday' | 'exam' | 'event';

export interface SchoolEvent {
  id: string;
  title: string;
  description: string;
  starts_on: string;
  ends_on: string | null;
  category: EventCategory;
  created_by: string;
}

export interface Activity {
  id: string;
  name: string;
  description: string;
  meets: string;
  leader_id: string;
  leader?: { full_name: string } | null;
  members: { user_id: string; profile: { full_name: string } | null }[];
}

export interface Message {
  id: number;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
}

export interface Report {
  id: string;
  student_id: string;
  class_id: string;
  term: string;
  grade: string;
  comment: string;
  published: boolean;
  updated_at: string;
  class?: { name: string } | null;
}
