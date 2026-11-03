// The only file that knows where data lives.
// Phase 1: the browser's localStorage (each device sees its own copy).
// Phase 2: swap these functions for Supabase calls; pages keep calling the same names.
// Every function is async so the pages are already written the way Supabase works.

import type { Announcement, Classroom, Role, Session } from './types';

const KEYS = {
  announcements: 'announcements', // same key as legacy/home.html, so old posts carry over
  session: 'schooling.session',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage full: the change lives until the page reloads.
  }
}

// ---------- Session (mock login) ----------

export async function getSession(): Promise<Session | null> {
  return read<Session | null>(KEYS.session, null);
}

export async function signIn({ name, role }: { name: string; role: Role }): Promise<Session> {
  const session: Session = { name, role, signedInAt: new Date().toISOString() };
  write(KEYS.session, session);
  return session;
}

export async function signOut(): Promise<void> {
  try {
    localStorage.removeItem(KEYS.session);
  } catch {
    // nothing to clear
  }
}

// ---------- Announcements ----------

// What legacy/home.html saved: no id, date and time as display strings.
interface LegacyAnnouncement {
  title: string;
  text: string;
  date?: string;
  time?: string;
  editflag?: boolean;
}

function normalise(item: Announcement | LegacyAnnouncement, index: number): Announcement {
  if ('id' in item) return item;
  return {
    id: `legacy-${index}-${item.title}`,
    title: item.title,
    text: item.text,
    createdAt: null,
    legacyDate: [item.date, item.time].filter(Boolean).join(' '),
    editedAt: item.editflag ? 'legacy' : undefined,
  };
}

export async function listAnnouncements(): Promise<Announcement[]> {
  return read<(Announcement | LegacyAnnouncement)[]>(KEYS.announcements, []).map(normalise);
}

async function saveAnnouncements(list: Announcement[]): Promise<Announcement[]> {
  write(KEYS.announcements, list);
  return list;
}

export async function createAnnouncement({ title, text }: Pick<Announcement, 'title' | 'text'>) {
  const list = await listAnnouncements();
  const item: Announcement = {
    id: crypto.randomUUID(),
    title,
    text,
    createdAt: new Date().toISOString(),
  };
  return saveAnnouncements([item, ...list]);
}

export async function updateAnnouncement(id: string, { title, text }: Pick<Announcement, 'title' | 'text'>) {
  const list = await listAnnouncements();
  return saveAnnouncements(
    list.map((item) =>
      item.id === id ? { ...item, title, text, editedAt: new Date().toISOString() } : item,
    ),
  );
}

export async function deleteAnnouncement(id: string) {
  const list = await listAnnouncements();
  return saveAnnouncements(list.filter((item) => item.id !== id));
}

// ---------- Classrooms ----------
// Names from legacy/home.html. Phase 2 reads these from the classes table.

export async function listClassrooms(): Promise<Classroom[]> {
  return [
    { id: '1', name: 'Classroom 1' },
    { id: '2', name: 'Classroom 2' },
    { id: '3', name: 'Classroom 3' },
  ];
}
