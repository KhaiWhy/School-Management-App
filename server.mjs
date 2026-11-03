// Node + Express server for Render "Web Service" deploys.
// 1. Serves the built React app (dist/) with page refreshes working.
// 2. POST /api/auth/login — sign in with a username. Only the server can look up
//    the email behind a username, so emails are never exposed to the browser.
//
// Environment (Render → Environment, or .env.local on your computer):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   same values the app uses
//   SUPABASE_SERVICE_ROLE_KEY                    secret! server only, never VITE_
//   PORT                                         Render sets this

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const port = Number(process.env.PORT) || 3000;
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = url && serviceKey ? createClient(url, serviceKey, noSession) : null;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Render sits in front; use the real visitor IP for rate limits

app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
  });
  next();
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// ---------- Username sign-in ----------

// Simple in-memory limit: 10 tries per IP per 10 minutes.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRIES = 10;
const tries = new Map();

function tooMany(ip) {
  const now = Date.now();
  const entry = tries.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    tries.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_TRIES;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of tries) if (now - entry.start > WINDOW_MS) tries.delete(ip);
}, WINDOW_MS).unref();

app.post('/api/auth/login', express.json({ limit: '10kb' }), async (req, res) => {
  if (!admin || !anonKey) {
    return res.status(503).json({ error: 'Username sign-in is not set up yet. Sign in with your email.' });
  }
  if (tooMany(req.ip)) {
    return res.status(429).json({ error: 'Too many attempts. Wait a few minutes and try again.' });
  }

  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({ error: 'Enter your username and password.' });
  }

  const wrong = () => res.status(401).json({ error: 'Wrong username or password.' });

  const { data: email, error: lookupError } = await admin.rpc('email_for_username', { name: username.slice(0, 60) });
  if (lookupError) {
    console.error('username lookup failed:', lookupError.message);
    return res.status(500).json({ error: 'Sign-in is having trouble. Try your email instead.' });
  }
  if (!email) return wrong();

  // A fresh client per request so sessions never mix between users.
  const client = createClient(url, anonKey, noSession);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) return wrong();

  res.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// ---------- The React app ----------

app.use(
  express.static(dist, {
    index: false,
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);

// Every other path loads index.html and React Router shows the right page.
app.get('/{*path}', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(dist, 'index.html'));
});

app.listen(port, () => {
  console.log(`Schooling listening on port ${port}`);
  if (!admin) console.log('Note: SUPABASE_SERVICE_ROLE_KEY not set, so username sign-in is off (email sign-in still works).');
});
