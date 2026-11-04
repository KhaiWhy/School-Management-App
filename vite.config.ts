import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The app reads exactly two settings: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY
// (from .env.local on your computer, or Render → Environment). Only these two are put
// into the browser code; nothing else from the environment is, so a secret in the same
// file can never leak into the site.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
    plugins: [react()],
    define: {
      'import.meta.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL ?? ''),
      'import.meta.env.SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.SUPABASE_PUBLISHABLE_KEY ?? ''),
    },
  };
});
