import { createClient } from '@supabase/supabase-js';

// The only two settings: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, from .env.local (on your
// computer) or Render → Environment (live); vite.config.ts puts them in. The publishable key
// is meant to be public; Row Level Security in the database protects the data.
export const url = import.meta.env.SUPABASE_URL as string;
export const publishableKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY as string;

export const isConfigured = Boolean(url && publishableKey);

// Without them the app shows SetupNeeded and never calls this placeholder address.
export const supabase = createClient(url || 'https://not-configured.invalid', publishableKey || 'not-configured');

// Turns a Supabase result into data, or throws a readable error.
// The data functions say what they return (src/data/types.ts), so T comes from there.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unwrap<T = any>(result: { data: unknown; error: { message: string; code?: string } | null }): T {
  if (result.error) throw new Error(friendlyError(result.error));
  return result.data as T;
}

function friendlyError(error: { message: string; code?: string }): string {
  if (/failed to fetch|networkerror|load failed/i.test(error.message)) {
    return "Can't reach the server. Check your internet connection and try again.";
  }
  if (/invalid login credentials/i.test(error.message)) return 'Wrong email or password.';
  if (/mime type .* is not supported/i.test(error.message)) {
    return "That type of file can't be uploaded. Use a PDF, Word, PowerPoint, Excel, image, text or zip file.";
  }
  if (/exceeded the maximum allowed size|payload too large/i.test(error.message)) {
    return 'That file is too big. Files can be up to 20 MB.';
  }
  if (error.code === '23505') return 'That already exists. Try a different value.';
  if (error.code === '42501' || /row-level security/i.test(error.message)) {
    return "You don't have permission to do that.";
  }
  if (error.code === '23514') return 'Some of the values are not allowed. Check the form and try again.';
  return error.message;
}
