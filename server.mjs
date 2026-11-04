// Optional Node + Express server, for a Render "Web Service" deploy.
// It only serves the built React app (dist/) with page refreshes working — it needs no
// settings or secrets (the app talks to Supabase directly). A Render "Static Site" does
// the same job without this file; see DEPLOY.md.
//
// Environment: PORT (Render sets it).

import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const port = Number(process.env.PORT) || 3000;
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');

const app = express();
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
  });
  next();
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

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
});
