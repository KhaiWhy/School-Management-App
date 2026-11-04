import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Icon, { type IconName } from './Icon';

// What's inside the app, in the same groups as the side menu.
const GROUPS: { label: string; icon: IconName; items: string }[] = [
  { label: 'Learn', icon: 'classroom', items: 'Classes, assignments and materials' },
  { label: 'Schedule', icon: 'timetable', items: 'Timetable, calendar and activities' },
  { label: 'Talk', icon: 'message', items: 'Messages with your teachers and classmates' },
  { label: 'Records', icon: 'merit', items: 'Attendance, reports and merits' },
];

// Sign-in pages: the app's contents on the left, the form on the right (stacked on phones).
export default function AuthShell({ title, lead, top, children }: { title: string; lead?: ReactNode; top?: ReactNode; children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <p className="auth-brand">Schooling</p>
        <div className="auth-pitch">
          <p className="auth-headline">Classes, work, timetable and messages in one place.</p>
          <ul className="auth-groups">
            {GROUPS.map((g) => (
              <li key={g.label}>
                <span className="auth-group-icon"><Icon name={g.icon} size={18} /></span>
                <span>
                  <strong>{g.label}</strong>
                  <small>{g.items}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="auth-side-note">For students and teachers. Teachers get their account from the school's admin.</p>
      </aside>

      <main className="auth-main">
        <div className="auth-panel">
          {top}
          <h1 className="auth-title">{title}</h1>
          {lead && <p className="auth-lead">{lead}</p>}
          {children}
          <p className="auth-footer"><Link to="/privacy">Privacy</Link></p>
        </div>
      </main>
    </div>
  );
}

// Password field with a Show / Hide button.
export function PasswordField({ label, name, autoComplete, minLength, hint }: {
  label: string;
  name: string;
  autoComplete: string;
  minLength?: number;
  hint?: string;
}) {
  const [shown, setShown] = useState(false);
  const id = `pw-${name}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <span className="password-wrap">
        <input id={id} name={name} type={shown ? 'text' : 'password'} autoComplete={autoComplete} minLength={minLength} required />
        <button type="button" className="password-toggle" aria-controls={id} aria-pressed={shown} onClick={() => setShown(!shown)}>
          {shown ? 'Hide' : 'Show'}
        </button>
      </span>
      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}
