import { supabase, unwrap } from '../lib/supabase';
import { today } from '../lib/format';
import type { EventCategory, SchoolEvent, TimetableSlot } from './types';

// ---------- Timetable ----------

export async function listSlots(): Promise<TimetableSlot[]> {
  return unwrap(
    await supabase
      .from('timetable_slots')
      .select('*, class:classes(name, teacher_id)')
      .order('weekday')
      .order('starts_at'),
  );
}

export async function addSlot(input: {
  classId: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  room: string;
}) {
  unwrap(
    await supabase.from('timetable_slots').insert({
      class_id: input.classId,
      weekday: input.weekday,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      room: input.room.trim() || null,
    }),
  );
}

export async function deleteSlot(id: string) {
  unwrap(await supabase.from('timetable_slots').delete().eq('id', id));
}

// ---------- School calendar ----------

// Your school's events: the newest 500, shown in date order.
export async function listEvents(): Promise<SchoolEvent[]> {
  const rows: SchoolEvent[] = unwrap(await supabase.from('events').select('*').order('starts_on', { ascending: false }).limit(500));
  return rows.reverse();
}

// What's still to come (or still going on), soonest first.
export async function listUpcomingEvents(limit = 10): Promise<SchoolEvent[]> {
  const t = today();
  return unwrap(
    await supabase.from('events').select('*').or(`starts_on.gte.${t},ends_on.gte.${t}`).order('starts_on').limit(limit),
  );
}

export async function addEvent(input: {
  title: string;
  description: string;
  startsOn: string;
  endsOn: string;
  category: EventCategory;
}) {
  unwrap(
    await supabase.from('events').insert({
      title: input.title.trim(),
      description: input.description.trim(),
      starts_on: input.startsOn,
      ends_on: input.endsOn || null,
      category: input.category,
    }),
  );
}

export async function deleteEvent(id: string) {
  unwrap(await supabase.from('events').delete().eq('id', id));
}
