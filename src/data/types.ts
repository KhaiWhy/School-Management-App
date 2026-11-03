// Shapes of the app's data. Phase 2: these match the Supabase tables.

export type Role = 'student' | 'teacher';

export interface Session {
  name: string;
  role: Role;
  signedInAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  text: string;
  createdAt: string | null; // null for posts saved by legacy/home.html
  editedAt?: string; // 'legacy' when edited in the old page
  legacyDate?: string;
}

export interface Classroom {
  id: string;
  name: string;
}
