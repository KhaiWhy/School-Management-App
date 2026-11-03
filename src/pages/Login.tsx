import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import * as auth from '../data/auth';
import { useAction } from '../lib/useLoad';
import { ErrorNote } from '../components/ui';

type Mode = 'signin' | 'signup' | 'forgot';

function value(form: HTMLFormElement, name: string) {
  return (form.elements.namedItem(name) as HTMLInputElement).value;
}

export default function Login() {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('signin');
  const [notice, setNotice] = useState<string | null>(null);
  const action = useAction();

  if (session && profile) return <Navigate to="/" replace />;

  const goNext = () => navigate(location.state?.from?.pathname ?? '/', { replace: true });

  function switchTo(next: Mode) {
    setMode(next);
    setNotice(null);
    action.setError(null);
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await action.run(() => auth.signIn(value(form, 'login'), value(form, 'password')))) goNext();
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    let signedIn = false;
    const ok = await action.run(async () => {
      ({ signedIn } = await auth.signUp({
        fullName: value(form, 'fullName').trim(),
        email: value(form, 'email').trim(),
        password: value(form, 'password'),
      }));
    });
    if (!ok) return;
    if (signedIn) goNext();
    else setNotice('Account created. Check your email for the confirmation link, then sign in.');
  }

  async function handleForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await action.run(() => auth.sendPasswordReset(value(form, 'email')))) {
      setNotice('If that email has an account, a reset link is on its way.');
    }
  }

  return (
    <main className="login">
      <div className="login-card">
        <h1 className="brand brand-large">Schooling</h1>

        {mode !== 'forgot' && (
          <div className="segmented" role="tablist" aria-label="Sign in or create an account">
            <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => switchTo('signin')}>
              Sign in
            </button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => switchTo('signup')}>
              Create account
            </button>
          </div>
        )}

        {notice && <p className="notice" role="status">{notice}</p>}
        <ErrorNote error={action.error} />

        {mode === 'signin' && (
          <form className="stack" onSubmit={handleSignIn}>
            <label className="field">
              Username or email
              <input name="login" autoComplete="username" autoCapitalize="none" required />
            </label>
            <label className="field">
              Password
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={action.busy}>
              {action.busy ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="button" className="link-button" onClick={() => switchTo('forgot')}>
              Forgot your password?
            </button>
          </form>
        )}

        {mode === 'signup' && (
          <form className="stack" onSubmit={handleSignUp}>
            <label className="field">
              Full name
              <input name="fullName" autoComplete="name" maxLength={120} required />
            </label>
            <label className="field">
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label className="field">
              Password
              <input name="password" type="password" autoComplete="new-password" minLength={8} required />
              <small className="hint">At least 8 characters.</small>
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={action.busy}>
              {action.busy ? 'Creating account…' : 'Create account'}
            </button>
            <p className="login-note">
              Your username is made from your email. You can change it later in your profile.
            </p>
          </form>
        )}

        {mode === 'forgot' && (
          <form className="stack" onSubmit={handleForgot}>
            <p className="login-lead">We'll email you a link to set a new password.</p>
            <label className="field">
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={action.busy}>
              Send reset link
            </button>
            <button type="button" className="link-button" onClick={() => switchTo('signin')}>
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
