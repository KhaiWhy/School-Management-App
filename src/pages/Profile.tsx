import { useState, type FormEvent } from 'react';
import { useAuth, useUser } from '../auth/AuthContext';
import Avatar from '../components/Avatar';
import { ErrorNote, PageHeader } from '../components/ui';
import { useTheme } from '../lib/theme';
import { ThemePicker } from './More';
import { updatePassword } from '../data/auth';
import { updateMyProfile } from '../data/people';
import { useAction } from '../lib/useLoad';

export default function Profile() {
  const user = useUser();
  const { session, setProfile } = useAuth();
  const details = useAction();
  const password = useAction();
  const [notice, setNotice] = useState<string | null>(null);
  const { choice, setChoice } = useTheme();

  async function handleDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const full_name = (form.elements.namedItem('fullName') as HTMLInputElement).value;
    const username = (form.elements.namedItem('username') as HTMLInputElement).value;
    setNotice(null);
    if (await details.run(async () => setProfile(await updateMyProfile(user.id, { full_name, username })))) {
      setNotice('Profile saved.');
    }
  }

  async function handlePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const next = (form.elements.namedItem('password') as HTMLInputElement).value;
    setNotice(null);
    if (await password.run(() => updatePassword(next))) {
      form.reset();
      setNotice('Password changed.');
    }
  }

  return (
    <section className="page">
      <PageHeader title="Profile" />
      <div className="profile-card">
        <Avatar name={user.full_name || user.username} size={72} />
        <dl>
          <dt>Name</dt>
          <dd>{user.full_name || '—'}</dd>
          <dt>Username</dt>
          <dd>@{user.username}</dd>
          <dt>Email</dt>
          <dd>{session?.user.email}</dd>
          <dt>Role</dt>
          <dd className="capitalise">{user.role}</dd>
        </dl>
      </div>

      {notice && <p className="notice" role="status">{notice}</p>}

      <section className="panel">
        <h2 className="panel-title">Appearance</h2>
        <ThemePicker value={choice} onChange={setChoice} />
        <p className="hint">System follows your device's light or dark setting.</p>
      </section>

      <form className="panel stack" onSubmit={handleDetails}>
        <h2 className="panel-title">Your details</h2>
        <label className="field">
          Full name
          <input name="fullName" defaultValue={user.full_name} maxLength={120} required />
        </label>
        <label className="field">
          Username
          <input
            name="username"
            defaultValue={user.username}
            pattern="[A-Za-z0-9._]{3,30}"
            title="3–30 letters, numbers, dots or underscores"
            autoCapitalize="none"
            required
          />
          <small className="hint">You sign in with this. 3–30 letters, numbers, dots or underscores.</small>
        </label>
        <ErrorNote error={details.error} />
        <button type="submit" className="btn btn-primary" disabled={details.busy}>Save details</button>
      </form>

      <form className="panel stack" onSubmit={handlePassword}>
        <h2 className="panel-title">Change password</h2>
        <label className="field">
          New password
          <input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <ErrorNote error={password.error} />
        <button type="submit" className="btn btn-primary" disabled={password.busy}>Change password</button>
      </form>
    </section>
  );
}
