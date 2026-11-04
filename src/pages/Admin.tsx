import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar';
import { ThemeToggle } from '../components/Layout';
import { Empty, ErrorNote, Loading } from '../components/ui';
import * as admin from '../data/admin';
import { formatDate } from '../lib/format';
import { useAction, useLoad } from '../lib/useLoad';

// /admin — opened with the passkey, not with an account. The passkey is kept for this
// browser tab only (sessionStorage) and sent with every request; the database checks it.

const KEY = 'schooling.admin';

function readKey() {
  try {
    return sessionStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export default function Admin() {
  const [passkey, setPasskey] = useState(readKey);
  const [tab, setTab] = useState<'people' | 'teachers' | 'schools' | 'classes'>('people');

  function lock() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // nothing stored
    }
    setPasskey('');
  }

  if (!passkey) {
    return (
      <Unlock
        onOpen={(key) => {
          try {
            sessionStorage.setItem(KEY, key);
          } catch {
            // works for this page view only
          }
          setPasskey(key);
        }}
      />
    );
  }

  return (
    <div className="admin">
      <header className="topbar admin-topbar">
        <span className="brand">Schooling <span className="admin-tag">Admin</span></span>
        <div className="topbar-user">
          <ThemeToggle />
          <Link to="/" className="btn">Open the app</Link>
          <button type="button" className="btn" onClick={lock}>Lock</button>
        </div>
      </header>
      <main className="admin-main">
        <div className="tabs" role="tablist" aria-label="Admin sections">
          {(
            [
              ['people', 'People'],
              ['teachers', 'Teachers'],
              ['schools', 'Schools'],
              ['classes', 'Classes'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === 'people' && <People passkey={passkey} onLocked={lock} />}
          {tab === 'teachers' && <Teachers passkey={passkey} onLocked={lock} />}
          {tab === 'schools' && <Schools passkey={passkey} onLocked={lock} />}
          {tab === 'classes' && <Classes passkey={passkey} onLocked={lock} />}
        </div>
      </main>
    </div>
  );
}

// A wrong or locked passkey sends the page back to the lock screen.
function useLockOnBadKey(error: string | null, onLocked: () => void) {
  useEffect(() => {
    if (error && /passkey/i.test(error)) onLocked();
  }, [error, onLocked]);
}

function Unlock({ onOpen }: { onOpen: (key: string) => void }) {
  const action = useAction();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = (event.currentTarget.elements.namedItem('passkey') as HTMLInputElement).value;
    if (await action.run(() => admin.checkPasskey(key))) onOpen(key);
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="brand brand-large">Schooling admin</h1>
        <p className="login-lead">Enter the admin passkey.</p>
        <ErrorNote error={action.error} />
        <label className="field">
          Passkey
          <input name="passkey" type="password" autoComplete="off" required autoFocus />
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={action.busy}>
          {action.busy ? 'Checking…' : 'Open'}
        </button>
        <p className="login-note">
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </main>
  );
}

function People({ passkey, onLocked }: { passkey: string; onLocked: () => void }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data: people = [], loading, error, reload } = useLoad(() => admin.listPeople(passkey, query), [passkey, query]);
  const { data: schools = [] } = useLoad(() => admin.listSchools(passkey), [passkey]);
  const action = useAction();
  const [resetDone, setResetDone] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  useLockOnBadKey(error ?? action.error, onLocked);

  async function change(id: string, name: string, role: 'student' | 'teacher') {
    if (!window.confirm(`Make ${name} a ${role}?`)) return;
    if (await action.run(() => admin.setRole(passkey, id, role))) await reload();
  }

  async function reset(p: admin.AdminPerson) {
    const name = p.full_name || p.username;
    if (!window.confirm(`Reset ${name}'s password? They will be signed out and need the new one-time password to sign in.`)) return;
    let password = '';
    if (await action.run(async () => { password = await admin.resetPassword(passkey, p.id); })) {
      setResetDone({ name, email: p.email, password });
      setCopied(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard blocked: the password is on screen to copy by hand.
    }
  }

  async function moveSchool(id: string, school: string) {
    if (await action.run(() => admin.setSchool(passkey, id, school || null))) await reload();
  }

  return (
    <section>
      <form
        className="field-row"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
        }}
      >
        <label className="field">
          Search
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, username, email or school" />
        </label>
        <button type="submit" className="btn field-row-button">Search</button>
      </form>
      <p className="hint">Everyone who signs up is a student. Make teacher accounts on the Teachers tab, or change a role here. Reset password gives a new one-time password, for anyone who forgot theirs.</p>
      <ErrorNote error={action.error ?? error} />
      {resetDone && (
        <div className="panel new-code" role="status">
          <p>
            New password for <strong>{resetDone.name}</strong> ({resetDone.email}). One-time password — copy it now, it won't be shown again:
          </p>
          <p className="new-code-value">{resetDone.password}</p>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={() => copy(resetDone.password)}>{copied ? 'Copied' : 'Copy password'}</button>
            <button type="button" className="btn" onClick={() => setResetDone(null)}>Done</button>
          </div>
        </div>
      )}
      {loading && people.length === 0 ? (
        <Loading />
      ) : people.length === 0 ? (
        <Empty>No one found.</Empty>
      ) : (
        <>
        {people.length >= 500 && <p className="hint">Showing the first 500. Search to find someone else.</p>}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">School</th>
                <th scope="col">Joined</th>
                <th scope="col">Role</th>
                <th scope="col"><span className="visually-hidden">Password</span></th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="person">
                      <Avatar name={p.full_name || p.username} size={32} />
                      <span>
                        {p.full_name || '—'} <small>@{p.username}</small>
                      </span>
                    </span>
                  </td>
                  <td>{p.email}</td>
                  <td>
                    <label className="visually-hidden" htmlFor={`school-${p.id}`}>School for {p.full_name}</label>
                    <select id={`school-${p.id}`} value={p.school_id ?? ''} disabled={action.busy} onChange={(e) => moveSchool(p.id, e.target.value)}>
                      <option value="">Not set</option>
                      {schools.map((sc) => (
                        <option key={sc.id} value={sc.id}>{sc.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>{formatDate(p.created_at)}</td>
                  <td>
                    <label className="visually-hidden" htmlFor={`role-${p.id}`}>Role for {p.full_name}</label>
                    <select
                      id={`role-${p.id}`}
                      value={p.role === 'admin' ? 'teacher' : p.role}
                      disabled={action.busy}
                      onChange={(e) => change(p.id, p.full_name || p.username, e.target.value as 'student' | 'teacher')}
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                    </select>
                  </td>
                  <td>
                    <button type="button" className="btn btn-small nowrap" disabled={action.busy} onClick={() => reset(p)}>
                      Reset password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </section>
  );
}

function Teachers({ passkey, onLocked }: { passkey: string; onLocked: () => void }) {
  const { data: schools = [] } = useLoad(() => admin.listSchools(passkey), [passkey]);
  const { data: people = [], reload } = useLoad(() => admin.listPeople(passkey, ''), [passkey]);
  const action = useAction();
  const [made, setMade] = useState<{ email: string; password: string; existing: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  useLockOnBadKey(action.error, onLocked);
  const teachers = people.filter((p) => p.role === 'teacher' || p.role === 'admin');

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const get = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value;
    const email = get('email').trim();
    let result: Awaited<ReturnType<typeof admin.createTeacher>> | null = null;
    const ok = await action.run(async () => {
      result = await admin.createTeacher(passkey, { email, name: get('name'), schoolId: get('schoolId') || null });
    });
    if (ok && result) {
      const r = result as Awaited<ReturnType<typeof admin.createTeacher>>;
      setMade({ email, password: r.password, existing: r.existing });
      setCopied(false);
      form.reset();
      await reload();
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // shown on screen to copy by hand
    }
  }

  return (
    <section>
      <form className="panel stack" onSubmit={handleCreate}>
        <h2 className="panel-title">New teacher account</h2>
        <div className="field-row">
          <label className="field">
            Full name
            <input name="name" maxLength={120} required placeholder="e.g. Ms Park" />
          </label>
          <label className="field">
            Email
            <input name="email" type="email" required placeholder="name@school.edu" />
          </label>
          <label className="field">
            School
            <select name="schoolId" defaultValue="" required={schools.length > 0}>
              <option value="" disabled={schools.length > 0}>{schools.length ? 'Choose a school' : 'No schools yet'}</option>
              {schools.map((sc) => (
                <option key={sc.id} value={sc.id}>{sc.name}</option>
              ))}
            </select>
          </label>
        </div>
        <ErrorNote error={action.error} />
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={action.busy}>
            {action.busy ? 'Creating…' : 'Create teacher account'}
          </button>
        </div>
        <p className="hint">
          The account is made straight away with a one-time password. Give the teacher their email and that password;
          they sign in on the normal sign-in page and change it on their Profile. If the email already has an account,
          it becomes a teacher with this new password (the old one stops working). Teachers need a school to work
          with students.
        </p>
      </form>

      {made && (
        <div className="panel new-code" role="status">
          <p>
            {made.existing ? (
              <>
                <strong>{made.email}</strong> already had an account. It is now a teacher, its old password no longer
                works, and it has this one-time password — copy it now, it won't be shown again:
              </>
            ) : (
              <>
                Teacher account made for <strong>{made.email}</strong>. One-time password — copy it now, it won't be
                shown again:
              </>
            )}
          </p>
          <p className="new-code-value">{made.password}</p>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={() => copy(made.password)}>{copied ? 'Copied' : 'Copy password'}</button>
            <button type="button" className="btn" onClick={() => setMade(null)}>Done</button>
          </div>
        </div>
      )}

      <h2 className="section-title">Teachers ({teachers.length})</h2>
      {teachers.length === 0 ? (
        <Empty>No teachers yet.</Empty>
      ) : (
        <ul className="item-list">
          {teachers.map((t) => (
            <li key={t.id} className="item-row">
              <Avatar name={t.full_name || t.username} size={32} />
              <span className="item-main">
                <strong>{t.full_name || t.username}</strong>
                <small>{t.email} · {t.school_name ?? 'No school'}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Schools({ passkey, onLocked }: { passkey: string; onLocked: () => void }) {
  const { data: schools = [], loading, error, reload } = useLoad(() => admin.listSchools(passkey), [passkey]);
  const action = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  useLockOnBadKey(error ?? action.error, onLocked);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value;
    if (await action.run(() => admin.saveSchool(passkey, null, name))) {
      form.reset();
      await reload();
    }
  }

  async function handleRename(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const name = (event.currentTarget.elements.namedItem('name') as HTMLInputElement).value;
    if (await action.run(() => admin.saveSchool(passkey, id, name))) {
      setEditing(null);
      await reload();
    }
  }

  return (
    <section>
      <form className="panel inline-form" onSubmit={handleAdd}>
        <h2 className="panel-title">Add a school</h2>
        <label className="field">
          School name
          <input name="name" minLength={2} maxLength={120} required />
        </label>
        <button type="submit" className="btn btn-primary" disabled={action.busy}>Add school</button>
      </form>
      <p className="hint">Students choose their school when they create an account. Only the name is kept.</p>
      <ErrorNote error={action.error ?? error} />
      {loading && schools.length === 0 ? (
        <Loading />
      ) : schools.length === 0 ? (
        <Empty>No schools yet. Add the first one above.</Empty>
      ) : (
        <ul className="item-list">
          {schools.map((sc) => (
            <li key={sc.id} className="item-row">
              {editing === sc.id ? (
                <form className="inline-form grow-form" onSubmit={(e) => handleRename(e, sc.id)}>
                  <label className="field">
                    New name
                    <input name="name" defaultValue={sc.name} minLength={2} maxLength={120} required autoFocus />
                  </label>
                  <button type="submit" className="btn btn-primary" disabled={action.busy}>Save</button>
                  <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <>
                  <span className="item-main">
                    <strong>{sc.name}</strong>
                    <small>{sc.students} students · {sc.teachers} teachers</small>
                  </span>
                  <button type="button" className="btn btn-small" onClick={() => setEditing(sc.id)}>Rename</button>
                  <button
                    type="button"
                    className="btn btn-small btn-danger"
                    onClick={async () => {
                      if (window.confirm(`Delete ${sc.name}? People in it keep their accounts, with no school set.`) && (await action.run(() => admin.deleteSchool(passkey, sc.id)))) {
                        await reload();
                      }
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Classes({ passkey, onLocked }: { passkey: string; onLocked: () => void }) {
  const { data: classes = [], loading, error, reload } = useLoad(() => admin.listClasses(passkey), [passkey]);
  const [openId, setOpenId] = useState<string | null>(null);
  useLockOnBadKey(error, onLocked);

  return (
    <section>
      <ErrorNote error={error} />
      {loading && classes.length === 0 ? (
        <Loading />
      ) : classes.length === 0 ? (
        <Empty>No classes yet. Teachers create them on their Classes page.</Empty>
      ) : (
        <ul className="item-list">
          {classes.map((c) => (
            <li key={c.id} className="panel admin-class">
              <div className="submission-head">
                <span className="item-main">
                  <strong>{c.name}</strong>
                  <small>
                    {[c.subject, c.teacher_name].filter(Boolean).join(' · ')} · code {c.join_code}
                  </small>
                </span>
                <button type="button" className="btn btn-small" aria-expanded={openId === c.id} onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                  {c.students} {c.students === 1 ? 'student' : 'students'}
                </button>
              </div>
              {openId === c.id && <Members passkey={passkey} classId={c.id} className={c.name} onChanged={reload} onLocked={onLocked} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Members({
  passkey,
  classId,
  className,
  onChanged,
  onLocked,
}: {
  passkey: string;
  classId: string;
  className: string;
  onChanged: () => void;
  onLocked: () => void;
}) {
  const { data: members = [], loading, error, reload } = useLoad(() => admin.listClassMembers(passkey, classId), [passkey, classId]);
  const action = useAction();
  useLockOnBadKey(error ?? action.error, onLocked);

  if (loading && members.length === 0) return <Loading />;
  return (
    <>
      <ErrorNote error={action.error ?? error} />
      {members.length === 0 ? (
        <Empty>No students in this class.</Empty>
      ) : (
        <ul className="people-list">
          {members.map((m) => (
            <li key={m.id}>
              <span className="person">
                <Avatar name={m.full_name || m.username} size={28} />
                <span>
                  {m.full_name || m.username} <small>@{m.username}</small>
                </span>
              </span>
              <button
                type="button"
                className="btn btn-small"
                onClick={async () => {
                  if (window.confirm(`Remove ${m.full_name || m.username} from ${className}?`) && (await action.run(() => admin.removeMember(passkey, classId, m.id)))) {
                    await reload();
                    onChanged();
                  }
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
