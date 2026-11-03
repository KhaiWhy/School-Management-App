import { supabase, unwrap } from '../lib/supabase';
import type { Announcement } from './types';

const FIELDS = '*, author:profiles!announcements_author_id_fkey(full_name)';

// classId null = whole-school announcements (home page).
export async function listAnnouncements(classId: string | null): Promise<Announcement[]> {
  let query = supabase.from('announcements').select(FIELDS).order('created_at', { ascending: false }).limit(100);
  query = classId ? query.eq('class_id', classId) : query.is('class_id', null);
  return unwrap(await query);
}

export async function createAnnouncement(classId: string | null, { title, body }: { title: string; body: string }) {
  unwrap(await supabase.from('announcements').insert({ class_id: classId, title, body }));
}

export async function updateAnnouncement(id: string, { title, body }: { title: string; body: string }) {
  unwrap(await supabase.from('announcements').update({ title, body }).eq('id', id));
}

export async function deleteAnnouncement(id: string) {
  unwrap(await supabase.from('announcements').delete().eq('id', id));
}
