import { supabase, unwrap } from '../lib/supabase';
import type { Profile } from './types';

export async function signUp({ fullName, email, password }: { fullName: string; email: string; password: string }) {
  const data = unwrap(
    await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    }),
  );
  // With "Confirm email" off in Supabase there is a session straight away.
  return { signedIn: Boolean(data.session) };
}

// Sign in with an email, or with a username (looked up by our server so emails stay private).
export async function signIn(login: string, password: string) {
  const value = login.trim();
  if (value.includes('@')) {
    unwrap(await supabase.auth.signInWithPassword({ email: value, password }));
    return;
  }

  let response: Response;
  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: value, password }),
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  if (response.status === 404) {
    throw new Error('Username sign-in is not available here yet. Sign in with your email instead.');
  }
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    access_token?: string;
    refresh_token?: string;
  };
  if (!response.ok || !body.access_token || !body.refresh_token) {
    throw new Error(body.error ?? 'Wrong username or password.');
  }
  unwrap(
    await supabase.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token }),
  );
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function sendPasswordReset(email: string) {
  unwrap(
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    }),
  );
}

export async function updatePassword(password: string) {
  unwrap(await supabase.auth.updateUser({ password }));
}

export async function getProfile(id: string): Promise<Profile | null> {
  return unwrap(await supabase.from('profiles').select('*').eq('id', id).maybeSingle());
}
