# Deploying to Render

Two ways. Both build the same app; pick one.

| | **Web Service** (recommended now) | Static Site (what's live today) |
|---|---|---|
| What runs | `server.mjs` (Node + Express) serves the app | Render serves the built files |
| Sign in with **username** | Yes | No — email only |
| Price | Free (sleeps after 15 min idle; first visit then takes ~1 min) or Starter ~$7/month (always on) | Free, always on |
| Secret key | `SUPABASE_SERVICE_ROLE_KEY` lives on the server | Not needed |

Before either: Supabase is set up (SUPABASE-SETUP.md) and the code is pushed to
`KhaiWhy/School-Management-App` on `main`. `npm run build` works on your computer.
The build type-checks the `.ts`/`.tsx` files first, so a type error fails the deploy
and the previous version stays live — run `npm run typecheck` before pushing.

---

## A. Web Service (Node + Express)

1. https://dashboard.render.com → **New +** → **Web Service**.
2. **Git Provider** → pick `School-Management-App` (click **Configure account** if
   it isn't listed and allow that repo).
3. Fill in:

   | Field | Value |
   |---|---|
   | Name | `school-management-app` (becomes `https://<name>.onrender.com`; if the static site already uses this name, pick another, e.g. `schooling-app`) |
   | Language | **Node** |
   | Branch | `main` |
   | Region | the one closest to the school (e.g. Singapore) |
   | Root Directory | leave empty |
   | Build Command | `npm ci --include=dev && npm run build` |
   | Start Command | `npm start` |
   | Instance Type | **Free** to test; **Starter** when the school uses it (no sleeping) |

   `--include=dev` matters: the build needs TypeScript and Vite, which are dev tools.

4. **Environment Variables** → **Add Environment Variable**, add four:

   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role / secret key |
   | `NODE_VERSION` | `22` |

   Don't add `PORT` — Render sets it.

5. Open **Advanced** → **Health Check Path** → `/healthz`.
6. **Deploy Web Service**. Watch **Logs**; it's ready when you see
   `Schooling running on http://localhost:10000` (Render's port) and the status says **Live**.
7. Open the link at the top. No Redirects/Rewrites rule is needed — the server
   already sends every page to the app.

### Check it
- `https://<your-app>.onrender.com/healthz` shows `{"ok":true}`.
- Create an account, sign out, sign in with the **username** shown on your Profile page.
- Open `/timetable` directly and refresh: it loads.

### Switching from the static site
1. Make the Web Service as above and check it.
2. In Supabase → **Authentication** → **URL Configuration**, set **Site URL** to the new
   address and add `https://<new-address>/**` to **Redirect URLs**.
3. Delete the old static site (its **Settings** → bottom → **Delete Static Site**),
   or keep it as a backup.

---

## B. Static Site (no server)

1. **New +** → **Static Site** → pick `School-Management-App`.
2. Fill in:

   | Field | Value |
   |---|---|
   | Branch | `main` |
   | Root Directory | leave empty |
   | Build Command | `npm ci && npm run build` |
   | Publish Directory | `dist` |

3. **Environment** → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only.
   (Never the service-role key: a static site can't keep a secret.)
4. **Create Static Site**.
5. **Redirects/Rewrites** → **Add Rule**: Source `/*`, Destination `/index.html`,
   Action **Rewrite** → **Save Changes**. Without it, refreshing any page except
   the home page gives "Not Found".

People sign in with their **email** here; the username box shows a message saying so.

---

## After any change to the keys
Vite builds the `VITE_` values into the app, so after adding or changing them:
**Manual Deploy** → **Clear build cache & deploy**.

## Updating the site
Push to `main`. Render rebuilds on its own (see **Events**). A failed build keeps the
last good version live.

## Custom domain
**Settings** → **Custom Domains** → **Add Custom Domain**, then add the DNS record
Render shows at the domain provider. HTTPS is automatic. Afterwards add the new
address to Supabase **Site URL** and **Redirect URLs**.

## If something goes wrong
| What you see | Fix |
|---|---|
| Build fails: `tsc: not found` / `vite: not found` | Build command must be `npm ci --include=dev && npm run build` (Web Service) |
| Build fails with a TypeScript error | Run `npm run typecheck` locally, fix, push |
| `npm ci` lock-file error | Run `npm install` locally, commit `package-lock.json`, push |
| "The app isn't connected to its database yet" | `VITE_` keys missing → add them, **Clear build cache & deploy** |
| Username sign-in: "not set up yet" | `SUPABASE_SERVICE_ROLE_KEY` missing on the Web Service |
| Web Service very slow on first visit | Free instances sleep after 15 min; upgrade to Starter for the school |
| Static Site: pages 404 on refresh | The `/*` → `/index.html` rewrite is missing |
| Deploy "failed health check" | Health Check Path must be `/healthz`; check **Logs** for a crash |
