import type { Role } from '../data/types';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function isStaff(role: Role) {
  return role === 'teacher' || role === 'admin';
}

// One date style everywhere: "Thu 5 Nov, 23:59" (24-hour, matches the timetable).
// The year only shows when it isn't this year.
const LOCALE = 'en-GB';

function withYear(d: Date): Intl.DateTimeFormatOptions {
  return d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' };
}

export function formatDateTime(value: string) {
  const d = new Date(value);
  const date = d.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', ...withYear(d) });
  const time = d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date}, ${time}`;
}

// "2026-11-03" → "Tue 3 Nov" (year only if it isn't this year), without time-zone shifts.
export function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(LOCALE, options ?? { weekday: 'short', day: 'numeric', month: 'short', ...withYear(date) });
}

// "Thu 5 Nov, 23:59 · in 2 days" / "· tomorrow" / "· 3 days ago"
export function formatDue(value: string) {
  const due = new Date(value);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(due) - startOf(new Date())) / 86400000);
  const rel =
    days === 0 ? 'today' : days === 1 ? 'tomorrow' : days === -1 ? 'yesterday' : days > 0 ? `in ${days} days` : `${-days} days ago`;
  return `${formatDateTime(value)} · ${rel}`;
}

// "09:00:00" → "09:00"
export function formatTime(value: string) {
  return value.slice(0, 5);
}

// Today's date as "YYYY-MM-DD" in the viewer's time zone.
export function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// <input type="datetime-local"> value → ISO string (and back).
export function localInputToIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function confirmDelete(what: string) {
  return window.confirm(`Delete ${what}? This can't be undone.`);
}
