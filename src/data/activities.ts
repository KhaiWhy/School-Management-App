import { supabase, unwrap } from '../lib/supabase';
import type { Activity } from './types';

export async function listActivities(): Promise<Activity[]> {
  return unwrap(
    await supabase
      .from('activities')
      .select(
        '*, leader:profiles!activities_leader_id_fkey(full_name), members:activity_members(user_id, profile:profiles(full_name))',
      )
      .order('name'),
  );
}

export async function createActivity(input: { name: string; description: string; meets: string }) {
  unwrap(
    await supabase.from('activities').insert({
      name: input.name.trim(),
      description: input.description.trim(),
      meets: input.meets.trim(),
    }),
  );
}

export async function deleteActivity(id: string) {
  unwrap(await supabase.from('activities').delete().eq('id', id));
}

export async function joinActivity(activityId: string, userId: string) {
  unwrap(await supabase.from('activity_members').insert({ activity_id: activityId, user_id: userId }));
}

export async function leaveActivity(activityId: string, userId: string) {
  unwrap(
    await supabase.from('activity_members').delete().eq('activity_id', activityId).eq('user_id', userId),
  );
}
