# Deploying to Render (static site)

The app is plain front end (React + Vite), so Render hosts it as a free
**Static Site**: no server, no sleeping, always on. Every push to `main`
redeploys it automatically.

## Before you start
- The code is pushed to GitHub (`KhaiWhy/School-Management-App`, branch `main`).
- `npm run build` works on your computer and makes a `dist/` folder.
  It type-checks the `.ts`/`.tsx` files first, so a type error fails the build
  (on Render too) and the last good version stays live. Run `npm run typecheck`
  before pushing to catch these early.

## Option A — Blueprint (uses `render.yaml`, fewest clicks)
1. Go to https://dashboard.render.com and sign up / log in **with GitHub**.
2. Click **New +** → **Blueprint**.
3. Connect your GitHub account if asked, and give Render access to
   `School-Management-App` (only that repo is fine).
4. Pick the repo. Render reads `render.yaml` and shows one service:
   `school-management-app` (Static Site).
5. Click **Apply**. The first build takes about a minute.
6. Open the `*.onrender.com` link it gives you.

## Option B — by hand (same result)
1. **New +** → **Static Site** → pick `School-Management-App`.
2. Fill in:

   | Field | Value |
   |---|---|
   | Name | `school-management-app` (this becomes the URL) |
   | Branch | `main` |
   | Root Directory | leave empty |
   | Build Command | `npm ci && npm run build` |
   | Publish Directory | `dist` |

3. **Create Static Site**.
4. After it's created, open **Redirects/Rewrites** and add:

   | Source | Destination | Action |
   |---|---|---|
   | `/*` | `/index.html` | Rewrite |

   Without this, opening a page like `/timetable` directly (or refreshing it)
   shows "Not Found", because there is only one real HTML file.

## Check it worked
- The site opens on the sign-in page.
- Sign in as Teacher, post an announcement, then refresh: it is still there
  (on this device only — that's expected until Supabase is added).
- Open `https://<your-site>.onrender.com/timetable` directly: it loads, not a 404.

## Updating the site
Push to `main`. Render rebuilds and publishes on its own (see **Events** in
the dashboard). A failed build keeps the last good version live.

## Later: Supabase (Phase 2)
Add these under the site's **Environment** tab — never in the code or GitHub:

| Key | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key |

After adding them, click **Manual Deploy → Clear build cache & deploy**, because
Vite bakes these values in at build time.

## Custom domain (optional)
**Settings → Custom Domains → Add**, then add the DNS record Render shows at
your domain provider. Render sets up HTTPS for you.

## If something goes wrong
| What you see | Fix |
|---|---|
| Build fails with `npm ci` lock error | Run `npm install` locally, commit `package-lock.json`, push |
| Pages 404 on refresh | The `/*` → `/index.html` rewrite is missing |
| Blank page | Check **Logs**; make sure Publish Directory is `dist` |
| Old version still showing | Hard refresh (Ctrl+Shift+R); check the latest deploy in **Events** finished |
