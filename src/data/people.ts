import { supabase, unwrap } from '../lib/supabase';
import type { Profile, Role } from './types';

export async function listPeople(search = ''): Promise<Profile[]> {
  let query = supabase.from('profiles').select('*').order('full_name').limit(200);
  const term = search.trim().replace(/[%,()]/g, '');
  if (term) query = query.or(`full_name.ilike.%${term}%,username.ilike.%${term}%`);
  return unwrap(await query);
}

export async function updateMyProfile(id: string, changes: { full_name: string; username: string }) {
  return unwrap(
    await supabase
      .from('profiles')
      .update({ full_name: changes.full_name.trim(), username: changes.username.trim().toLowerCase() })
      .eq('id', id)
      .select()
      .single(),
  ) as Profile;
}

export async function setRole(id: string, role: Role) {
  unwrap(await supabase.from('profiles').update({ role }).eq('id', id));
}
