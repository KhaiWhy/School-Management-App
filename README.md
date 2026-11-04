# School-Management-App
App that digitizes school's management resources all in one app, ranging from assignments, announcements, attendance, timetable, merit systems and more.

## What it does
- **Students:** school and class announcements, join classes with a code, assignments
  (hand in text or files, see grades and feedback), class materials, timetable, school
  calendar, activities (CCAs), direct messages, own attendance, published reports and merits.
- **Teachers:** everything above, plus create classes, give merits and demerits, post to a class, set and grade
  assignments, upload materials, add lessons and events, run activities, take the
  register and write term reports.
- **Admins:** make people teachers or admins (People page).
- Sign up with full name, email and password; sign in with username (made from the
  email, editable) or email.

## Run it
Needs Node.js 22 or newer and a Supabase project (see [SUPABASE-SETUP.md](SUPABASE-SETUP.md)).

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase keys
npm run dev
```

Open http://localhost:5173. The app reads exactly two settings, `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` (both public; see `.env.example`).

| Command | Does |
|---|---|
| `npm run dev` | App with live reload |
| `npm run build` | Type-check, then build to `dist/` |
| `npm start` | Serve `dist/` with Node (only for a Render Web Service; a Static Site doesn't need it) |
| `npm run typecheck` | Type-check only |
| `npm run test:db` | Check all 182 database rules locally |
| `npm run admin:set-passkey` | Set or change the `/admin` passkey (reads `ADMIN_PASSKEY` from `.env.local`; stores only a hash) |

Deploying: [DEPLOY.md](DEPLOY.md).

## How it's built
- **Front end:** React + Vite + TypeScript (`.tsx`), React Router.
- **Back end:** Supabase — Postgres database, sign-in, file storage, live messages.
  Every table has Row Level Security, so the database itself decides who can see or
  change what (see `supabase/migrations/`).
- **Sign-in:** email or username + password. For a username, a database function checks the
  password and only then returns the email, so no server secret is needed.
- **Admin:** `/admin`, opened with a passkey (not an account): people, roles and schools,
  teacher accounts (made there; sign-up is for students), classes.
- **Hosting:** a Render Static Site (`server.mjs` is an optional Node server for a Web Service).

## Where things are
| Path | What it is |
|---|---|
| `src/App.tsx` | Every page and its address (route) |
| `src/pages/` | One file per page |
| `src/components/Layout.tsx` | Header, left menu, classrooms column |
| `src/components/Announcements.tsx` | Announcements (from the original `home.html`) |
| `src/components/AssignmentList.tsx`, `MaterialList.tsx` | Lists used on several pages |
| `src/components/ui.tsx` | Small shared pieces (errors, loading, class picker) |
| `src/data/` | All database calls, one file per area |
| `src/data/types.ts` | The shape of each kind of data |
| `src/auth/AuthContext.tsx` | Who is signed in, and page access per role |
| `src/lib/` | Supabase client, loading helpers, date formatting |
| `src/styles.css` | All styles |
| `supabase/migrations/` | The database: tables, rules, storage |
| `supabase/tests/` | Database rule checks (`npm run test:db`) |
| `DESIGN.md` | Colours, type, layout and the reasons behind them (Figma file: "WDS — Khai — School-Management-App") |
| `src/pages/Admin.tsx`, `src/data/admin.ts` | The passkey admin page |
| `scripts/set-admin-passkey.mjs` | Sets the admin passkey hash in Supabase |
| `src/pages/Privacy.tsx` | Public privacy page; keep it matching what the app stores and loads |
| `server.mjs` | Optional Node server (Render Web Service); serves the built app, no secrets |
| `legacy/` | The original HTML/CSS version, kept for reference |

## Adding a page
1. Make `src/pages/MyPage.tsx`.
2. Add a `<Route>` for it in `src/App.tsx`.
3. Add a link to `NAV_GROUPS` in `src/components/Layout.tsx`
   (add `roles: ['teacher', 'admin']` to limit who sees it).
4. Database calls go in a file in `src/data/`; new tables in a new file in
   `supabase/migrations/` with rules, plus checks in `supabase/tests/rls.test.mjs`.

## Look and feel
Palette "Classroom Blue" (evolves the blue and cyan from the first HTML version), light and dark
mode (toggle in the top bar; Profile → Appearance has Light / Dark / System). Rules in DESIGN.md.

## Not built yet
- Email alerts for new announcements.
- Announcements for one department (e.g. primary / secondary) only.
- App name, logo and colours (waiting on Khai).
