import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { updatePassword } from '../data/auth';
import { useAction } from '../lib/useLoad';
import { ErrorNote } from '../components/ui';
import AuthShell, { PasswordField } from '../components/AuthShell';

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
    <AuthShell title="Choose a new password" lead={session && !done ? 'Use at least 8 characters. You stay signed in afterwards.' : undefined}>
      {loading ? (
        <p className="auth-lead">Loading…</p>
      ) : !session ? (
        <p className="auth-lead">
          This reset link has expired or was already used. <Link to="/login">Request a new one</Link>.
        </p>
      ) : done ? (
        <p className="notice" role="status">Password changed. Taking you to the app…</p>
      ) : (
        <form className="stack" onSubmit={handleSubmit}>
          <ErrorNote error={action.error} />
          <PasswordField label="New password" name="password" autoComplete="new-password" minLength={8} />
          <PasswordField label="New password again" name="again" autoComplete="new-password" minLength={8} />
          <button type="submit" className="btn btn-primary btn-block btn-large" disabled={action.busy}>
            Save password
          </button>
        </form>
      )}
    </AuthShell>
  );
}
