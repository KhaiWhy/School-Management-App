import type { Role } from '../data/types';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function isStaff(role: Role) {
  return role === 'teacher' || role === 'admin';
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// "2026-11-03" → "3 Nov 2026" without time-zone shifts.
export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, options);
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
