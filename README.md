# School-Management-App
App that digitizes school's management resources all in one app, ranging from assignments, announcements, attendance, timetable, merit systems and more.

## Run it
Needs Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the link it prints (usually http://localhost:5173). `npm run build` makes the
production files in `dist/`. Deploying: see [DEPLOY.md](DEPLOY.md).

## How it's built
- **React + Vite + TypeScript** (`.tsx`), pages switched with **React Router**.
  `npm run typecheck` checks types; `npm run build` does too, so a type error stops a deploy.
- **Phase 1 (now):** front end only. Sign-in is a demo (pick Student or Teacher),
  and data is saved in the browser's localStorage, so each device has its own copy.
- **Phase 2 (next):** Supabase for real accounts, the database, file uploads and
  messages. Only `src/data/store.ts` and the sign-in change; the pages stay the same.

## Where things are
| Path | What it is |
|---|---|
| `src/App.tsx` | Every page and its address (route) |
| `src/components/Layout.tsx` | Header, left menu, classrooms column |
| `src/components/Announcements.tsx` | Announcements (from the original `home.html`) |
| `src/pages/` | One file per page |
| `src/data/store.ts` | All data reads and saves — the one file Supabase replaces |
| `src/data/types.ts` | The shape of each kind of data (Announcement, Classroom, ...) |
| `src/auth/AuthContext.tsx` | Who is signed in, and page access per role |
| `src/styles.css` | All styles |
| `legacy/` | The original HTML/CSS version, kept for reference |
| `render.yaml` | Render deploy settings |

## Adding a page
1. Make `src/pages/MyPage.tsx`.
2. Add a `<Route>` for it in `src/App.tsx`.
3. Add a link to the `NAV` list in `src/components/Layout.tsx`
   (add `roles: ['teacher']` to show it to teachers only).
