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

// Sign in with an email, or with a username. For a username, the database checks the
// password first and only then hands back the email (supabase/migrations/*_username_signin.sql),
// so emails stay private and no server secret is needed.
export async function signIn(login: string, password: string) {
  const value = login.trim();
  let email = value;
  if (!value.includes('@')) {
    const found: string | null = unwrap(await supabase.rpc('email_for_sign_in', { name: value, password }));
    if (!found) throw new Error('Wrong username or password.');
    email = found;
  }
  unwrap(await supabase.auth.signInWithPassword({ email, password }));
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
