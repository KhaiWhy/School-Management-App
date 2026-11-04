# Deploying to Render

The app needs exactly **two settings**, both safe to be public (Row Level Security in the
database protects the data):

| Key | Value (Supabase → Project Settings → API Keys) |
|---|---|
| `SUPABASE_URL` | Project URL, e.g. `https://abcd1234.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | the **publishable** key (`sb_publishable_…`) |

No secret keys anywhere: username sign-in is checked inside the database.

Before you start: Supabase is set up (SUPABASE-SETUP.md, all migrations run), the code is
pushed to `KhaiWhy/School-Management-App` on `main`, and `npm run build` works on your
computer. The build type-checks the `.ts`/`.tsx` files first, so a type error fails the
deploy and the previous version stays live — run `npm run typecheck` before pushing.

---

## A. Static Site (recommended — free, always on)

**Already have the static site from the first meeting?** Skip to step 3 and just change its
settings.

1. https://dashboard.render.com → **New +** → **Static Site** → pick `School-Management-App`
   (click **Configure account** if it isn't listed and allow that repo).
2. Fill in:

   | Field | Value |
   |---|---|
   | Name | `school-management-app` (becomes `https://<name>.onrender.com`) |
   | Branch | `main` |
   | Root Directory | leave empty |
   | Build Command | `npm ci && npm run build` |
   | Publish Directory | `dist` |

3. **Environment** → add the two keys from the table above. Remove any old
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` entries.
4. **Redirects/Rewrites** → **Add Rule**: Source `/*`, Destination `/index.html`,
   Action **Rewrite** → **Save Changes**. Without it, refreshing any page except the home
   page gives "Not Found".
5. **Manual Deploy** → **Clear build cache & deploy** (the two values are built into the
   app, so a plain redeploy isn't enough after changing them).
6. Open the `.onrender.com` link.

Or let Render read `render.yaml` instead of steps 1–4: **New +** → **Blueprint** → pick the
repo → it asks for the two keys → **Apply**.

### Check it
- The sign-in page opens (not "The app isn't connected to its database yet").
- Sign in with your **username** and with your **email** — both work.
- Open `/timetable` directly and refresh: it loads.
- `/privacy` opens without signing in.

### After the first deploy
In Supabase → **Authentication** → **URL Configuration**: set **Site URL** to the Render
address and add `https://<your-address>/**` to **Redirect URLs** (needed for "Forgot your
password?" emails).

---

## B. Web Service (optional)

Only if you later want a Node server in front (it adds nothing today). `server.mjs` serves
the built app and needs no secrets.

| Field | Value |
|---|---|
| Language | Node |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Environment | the same two keys, plus `NODE_VERSION` = `22` |
| Health Check Path | `/healthz` |

No rewrite rule needed — the server sends every page to the app. Free instances sleep
after 15 minutes idle (first visit then takes about a minute); Starter (~$7/month) doesn't.

---

## Updating the site
Push to `main`. Render rebuilds on its own (see **Events**). A failed build keeps the last
good version live. After changing either key: **Clear build cache & deploy**.

## Custom domain
**Settings** → **Custom Domains** → **Add Custom Domain**, then add the DNS record Render
shows at the domain provider. HTTPS is automatic. Afterwards add the new address to
Supabase **Site URL** and **Redirect URLs**.

## If something goes wrong
| What you see | Fix |
|---|---|
| "The app isn't connected to its database yet" | `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` missing or misspelt → fix, **Clear build cache & deploy** |
| Username sign-in says "Wrong username or password" but email works | The migration `20261103030000_username_signin.sql` hasn't been run in Supabase |
| "Too many attempts" | 10 wrong passwords for that username in 15 minutes; wait, or sign in with the email |
| Pages 404 on refresh (Static Site) | The `/*` → `/index.html` rewrite is missing |
| Build fails with a TypeScript error | Run `npm run typecheck` locally, fix, push |
| `npm ci` lock-file error | Run `npm install` locally, commit `package-lock.json`, push |
| Web Service: `tsc: not found` | Build command must be `npm ci --include=dev && npm run build` |
