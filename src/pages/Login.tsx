import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../data/types';

const ROLES: Role[] = ['student', 'teacher'];

// Phase 1: a pretend sign-in so both views can be shown.
// Phase 2: replace with Supabase email + password; the role comes from the profiles table.
export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<Role>('student');

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nameInput = event.currentTarget.elements.namedItem('name') as HTMLInputElement;
    const name = nameInput.value.trim();
    if (!name) return;
    await signIn({ name, role });
    navigate(location.state?.from?.pathname ?? '/', { replace: true });
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="brand brand-large">Schooling</h1>
        <p className="login-lead">Sign in to your school</p>

        <fieldset className="role-picker">
          <legend>I am a</legend>
          {ROLES.map((value) => (
            <label key={value} className={role === value ? 'is-active' : ''}>
              <input
                type="radio"
                name="role"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
              />
              <span className="capitalise">{value}</span>
            </label>
          ))}
        </fieldset>

        <label className="field">
          Your name
          <input name="name" autoComplete="name" required />
        </label>

        <button type="submit" className="btn btn-primary btn-block">Sign in</button>
        <p className="login-note">Demo sign-in: no password needed yet. Real accounts come next.</p>
      </form>
    </main>
  );
}
