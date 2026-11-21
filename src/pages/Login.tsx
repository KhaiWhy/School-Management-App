import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import * as auth from '../data/auth';
import { listSchools } from '../data/schools';
import { useAction, useLoad } from '../lib/useLoad';
import { ErrorNote } from '../components/ui';
import AuthShell, { PasswordField } from '../components/AuthShell';
import { getRemember, setRemember } from '../lib/supabase';

type Mode = 'signin' | 'signup' | 'forgot';

function value(form: HTMLFormElement, name: string) {
  return (form.elements.namedItem(name) as HTMLInputElement).value;
}

export default function Login() {
  const { session, profile } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('signin');
  const [notice, setNotice] = useState<string | null>(null);
  const action = useAction();
  const { data: schools = [] } = useLoad(listSchools, []);

  // Signed in (also right after signing in): go where you were heading.

  const next = (location.state?.from?.pathname as string | undefined) ?? '/';
  if (session && profile) return <Navigate to={next} replace />;

  function switchTo(next: Mode) {
    setMode(next);
    setNotice(null);
    action.setError(null);
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setRemember((form.elements.namedItem('remember') as HTMLInputElement).checked);
    await action.run(() => auth.signIn(value(form, 'login'), value(form, 'password')));
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!value(form, 'fullName').trim()) {
      action.setError('Please enter your full name.');
      (form.elements.namedItem('fullName') as HTMLInputElement).focus();
      return;
    }
    setRemember((form.elements.namedItem('remember') as HTMLInputElement).checked);
    let signedIn = false;
    const ok = await action.run(async () => {
      ({ signedIn } = await auth.signUp({
        fullName: value(form, 'fullName').trim(),
        email: value(form, 'email').trim(),
        password: value(form, 'password'),
        schoolId: value(form, 'schoolId'),
      }));
    });
    if (!ok) return;
    if (!signedIn) setNotice('Account created. Check your email for the confirmation link, then sign in.');
  }

  async function handleForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await action.run(() => auth.sendPasswordReset(value(form, 'email')))) {
      setNotice('If that email has an account, a reset link is on its way.');
    }
  }

  const titles: Record<Mode, [string, string]> = {
    signin: ['Sign in', 'Use your username or email.'],
    signup: ['Create a student account', "Teachers don't sign up here: your school's admin makes your account, then you sign in."],
    forgot: ['Forgot your password?', "We'll email you a link to set a new password."],
  };

  return (
    <AuthShell
      title={titles[mode][0]}
      lead={titles[mode][1]}
      top={
        mode !== 'forgot' && (
          <div className="segmented auth-tabs" role="tablist" aria-label="Sign in or create an account">
            <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => switchTo('signin')}>
              Sign in
            </button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => switchTo('signup')}>
              Create account
            </button>
          </div>
        )
      }
    >

      {notice && <p className="notice" role="status">{notice}</p>}
      <ErrorNote error={action.error} />

      {mode === 'signin' && (
        <form className="stack" onSubmit={handleSignIn}>
          <label className="field">
            Username or email
            <input name="login" autoComplete="username" autoCapitalize="none" required />
          </label>
          <PasswordField label="Password" name="password" autoComplete="current-password" />
          <div className="auth-row">
            <label className="check">
              <input name="remember" type="checkbox" defaultChecked={getRemember()} />
              Remember me
            </label>
            <button type="button" className="link-button" onClick={() => switchTo('forgot')}>
              Forgot password?
            </button>
          </div>
          <button type="submit" className="btn btn-primary btn-block btn-large" disabled={action.busy}>
            {action.busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="auth-hint">On a shared computer, leave Remember me unticked: you stay signed in only in this tab, until you close it.</p>
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
          <PasswordField label="Password" name="password" autoComplete="new-password" minLength={8} hint="At least 8 characters." />
          {schools.length > 0 && (
            <label className="field">
              Your school
              <select name="schoolId" required defaultValue="">
                <option value="" disabled>Choose your school</option>
                {schools.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="check">
            <input name="remember" type="checkbox" defaultChecked={getRemember()} />
            Remember me
          </label>
          <button type="submit" className="btn btn-primary btn-block btn-large" disabled={action.busy}>
            {action.busy ? 'Creating account…' : 'Create account'}
          </button>
          <p className="auth-hint">Your username is made from your email. You can change it later in your profile.</p>
        </form>
      )}

      {mode === 'forgot' && (
        <form className="stack" onSubmit={handleForgot}>
          <label className="field">
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <button type="submit" className="btn btn-primary btn-block btn-large" disabled={action.busy}>
            Send reset link
          </button>
          <p className="auth-hint">No email after a few minutes? Your school's admin can reset your password.</p>
          <button type="button" className="link-button auth-back" onClick={() => switchTo('signin')}>
            Back to sign in
          </button>
        </form>
      )}
    </AuthShell>
  );
}
