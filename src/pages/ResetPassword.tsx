import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { updatePassword } from '../data/auth';
import { useAction } from '../lib/useLoad';
import { ErrorNote } from '../components/ui';

// Opened from the password-reset email (Supabase signs the person in first).
export default function ResetPassword() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const action = useAction();
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const again = (form.elements.namedItem('again') as HTMLInputElement).value;
    if (password !== again) {
      action.setError('The two passwords are different.');
      return;
    }
    if (await action.run(() => updatePassword(password))) {
      setDone(true);
      setTimeout(() => navigate('/'), 1500);
    }
  }

  return (
    <main className="login">
      <div className="login-card">
        <h1 className="brand brand-large">Schooling</h1>
        {loading ? (
          <p className="login-lead">Loading…</p>
        ) : !session ? (
          <p className="login-lead">
            This reset link has expired or was already used. <Link to="/login">Request a new one</Link>.
          </p>
        ) : done ? (
          <p className="notice" role="status">Password changed. Taking you to the app…</p>
        ) : (
          <form className="stack" onSubmit={handleSubmit}>
            <p className="login-lead">Choose a new password.</p>
            <ErrorNote error={action.error} />
            <label className="field">
              New password
              <input name="password" type="password" autoComplete="new-password" minLength={8} required />
            </label>
            <label className="field">
              New password again
              <input name="again" type="password" autoComplete="new-password" minLength={8} required />
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={action.busy}>
              Save password
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
