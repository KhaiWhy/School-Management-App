// Sets (or changes) the /admin passkey.
//
//   1. Put ADMIN_PASSKEY=... in .env.local (16+ characters; a password manager can make one).
//   2. npm run admin:set-passkey
//
// The passkey is hashed here on your computer; only the salt and hash go to Supabase.
// It is never stored anywhere else — not in Render, not in GitHub, not in the site.
// Needs SUPABASE_URL and SUPABASE_ACCESS_TOKEN (Supabase → Account → Access Tokens) in .env.local.

import { createHash, randomBytes } from 'node:crypto';

const passkey = process.env.ADMIN_PASSKEY ?? '';
const token = process.env.SUPABASE_ACCESS_TOKEN ?? '';
const url = process.env.SUPABASE_URL ?? '';
const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

function stop(message) {
  console.error(message);
  process.exit(1);
}

if (passkey.length < 16) stop('ADMIN_PASSKEY in .env.local must be at least 16 characters.');
if (!token) stop('SUPABASE_ACCESS_TOKEN is missing from .env.local.');
if (!ref) stop('SUPABASE_URL in .env.local should look like https://<project>.supabase.co');

const salt = randomBytes(16).toString('hex');
const hash = createHash('sha256').update(salt + passkey).digest('hex');

const sql = `
insert into public.admin_settings (id, passkey_salt, passkey_hash, updated_at)
values (1, '${salt}', '${hash}', now())
on conflict (id) do update set passkey_salt = excluded.passkey_salt, passkey_hash = excluded.passkey_hash, updated_at = now();
delete from public.admin_attempts;`;

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
if (!res.ok) stop(`Supabase said ${res.status}: ${(await res.text()).slice(0, 300)}`);
console.log('Admin passkey set. Open /admin on the site and use it there.');
