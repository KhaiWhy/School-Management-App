import { supabase, unwrap } from '../lib/supabase';
import type { Profile } from './types';

// Search runs in the database; Row Level Security only returns people you share a class, a
// school (staff) or an activity with, or already talk to.
export async function searchPeople(search: string): Promise<Profile[]> {
  const term = search.trim().replace(/[%,()*\\]/g, '');
  if (!term) return [];
  return unwrap(
    await supabase
      .from('profiles')
      .select('*')
      .or(`full_name.ilike.%${term}%,username.ilike.%${term}%`)
      .order('full_name')
      .limit(20),
  );
}

// The profiles for a list of ids (for example everyone in your conversations).
export async function getPeople(ids: string[]): Promise<Profile[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const rows: Profile[] = [];
  for (let i = 0; i < unique.length; i += 100) {
    rows.push(...unwrap<Profile[]>(await supabase.from('profiles').select('*').in('id', unique.slice(i, i + 100))));
  }
  return rows;
}

// Your school is set by the school's admin, not here (database rule).
export async function updateMyProfile(id: string, changes: { full_name: string; username: string }) {
  return unwrap(
    await supabase
      .from('profiles')
      .update({
        full_name: changes.full_name.trim(),
        username: changes.username.trim().toLowerCase(),
      })
      .eq('id', id)
      .select()
      .single(),
  ) as Profile;
}
