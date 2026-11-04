import { supabase, unwrap } from '../lib/supabase';
import type { School } from './types';

// School names are public (the sign-up form lists them). Only the admin page adds them.
export async function listSchools(): Promise<School[]> {
  return unwrap(await supabase.from('schools').select('id, name').order('name'));
}
