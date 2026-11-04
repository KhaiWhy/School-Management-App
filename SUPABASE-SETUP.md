# Supabase setup

The database, sign-in and file storage all live in Supabase. This is a one-time
set-up, about 10 minutes. You need the Supabase project Khai made (Free plan,
"Enable automatic RLS" on).

## 1. Sign-in settings
**Authentication** → **Sign In / Providers**:
- **Email**: on.
- **Confirm email**: **off** (people can sign in straight after creating an account).
  Turn it back on later if the school wants email checks.
- Google and the other providers: leave off.

**Authentication** → **URL Configuration**:
- **Site URL**: your Render address, e.g. `https://school-management-app.onrender.com`
- **Redirect URLs** → add both:
  - `http://localhost:5173/**`
  - `https://school-management-app.onrender.com/**`

(These are used by the "Forgot your password?" email.)

## 2. Create the tables
1. **SQL Editor** → **New query**.
2. Open `supabase/migrations/20261103000000_init.sql` from this repo, copy **all** of
   it, paste, click **Run**. It should say "Success. No rows returned".
3. Check **Table Editor**: you should see `profiles`, `classes`, `class_members`,
   `announcements`, `assignments`, `submissions`, `materials`, `attendance`,
   `timetable_slots`, `events`, `activities`, `activity_members`, `messages`,
   `reports`. **Storage** has a private bucket `class-files`.

Run it once only. Running it again fails with "already exists" — that's harmless.

4. Then do the same with `supabase/migrations/20261103020000_lock_helpers.sql`: it limits the
   helper functions to signed-in users and sets the allowed file types (PDF, images, Word,
   PowerPoint, Excel, OpenDocument, text, CSV, zip; up to 20 MB). Safe to run again.
5. And `supabase/migrations/20261103030000_username_signin.sql`: lets people sign in with
   their **username** (the database checks the password, then hands back the email; 10 wrong
   tries in 15 minutes blocks that username for a while). Safe to run again.

What it sets up:

| Area | Who can do what |
|---|---|
| Accounts | Everyone who signs up is a **student**. The username comes from the email (`sam.tan@x.com` → `sam.tan`) and can be changed on the Profile page. Emails are never shown to other users. |
| Classes | Teachers create classes and get a 6-character **class code**. Students join with the code. You only see classes you teach or joined. |
| Announcements | Teachers post school-wide (Home) or to their own class (class Stream). Everyone reads school-wide; only the class reads class posts. |
| Assignments | The class teacher sets them. Students hand in text and/or a file; they can't see each other's work or change their grade. Teachers grade and give feedback. |
| Materials | The class teacher uploads files or links; the class can open them. |
| Attendance | The teacher takes the register. Students see only their own record. |
| Timetable, Calendar | Teachers add lessons to their classes; staff add school events. |
| Activities | Staff create activities; students join and leave themselves. |
| Messages | One-to-one; only the two people in a chat can read it. Live updates. |
| Reports | Teachers write a report per student, class and term; the student sees it only once it's **published**. |

## 3. Make the first admin and teachers
1. Open the app and **Create account** for yourself.
2. **SQL Editor**, run (use your own email):

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

3. Sign out and in again. You now see **People** in the menu: from there you can
   make anyone a teacher or admin — no more SQL needed.

## 4. Connect the app
The app reads exactly **two settings**. From **Project Settings** → **API Keys** (or the
green **Connect** button at the top):

| Copy | Into |
|---|---|
| Project URL | `SUPABASE_URL` |
| **Publishable** key (`sb_publishable_…`) | `SUPABASE_PUBLISHABLE_KEY` |

Both are meant to be public. The app never needs the secret / `service_role` key — don't
put it anywhere in this project. (`vite.config.ts` only puts these two names into the
browser code, so nothing else from `.env.local` can leak into the site.)

**On your computer:** copy `.env.example` to `.env.local`, fill in the two values, then:

```bash
npm install
npm run dev
```

**On Render:** add the same two keys under **Environment** (see DEPLOY.md).

## 5. Check it works
1. Create two accounts (one in a private window). Make one a teacher on **People**.
2. Teacher: **Classes** → create a class → note the code.
3. Student: **Classes** → join with the code. The class appears on the right.
4. Teacher: post in the class Stream, set an assignment, add a material, take attendance.
5. Student: hand in the assignment, send the teacher a message.
6. Teacher: grade it, write a report and tick "Visible to the student".
7. Student: sees the grade, the report and their attendance.

## Testing the rules without Supabase
`npm run test:db` runs the database file on a local copy of Postgres and checks
113 rules (who can read and change what, and username sign-in). Run it after changing the SQL.

## Changing the database later
Add a new file in `supabase/migrations/` (e.g. `20261201000000_add_departments.sql`),
run it in the SQL Editor, and add checks to `supabase/tests/rls.test.mjs`.
Never edit the first migration after it has been run on the live project.

## Problems
| What you see | Fix |
|---|---|
| "The app isn't connected to its database yet" | `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` missing. On Render, add them and redeploy with **Clear build cache** |
| "Your account has no profile yet" | The SQL wasn't run before that account was made. Run it, then in SQL Editor: `insert into public.profiles (id, full_name, username) select id, '', public.username_from_email(email) from auth.users where id not in (select id from public.profiles);` |
| "You don't have permission to do that" | Working as intended for that role, or the person isn't a teacher yet (People page) |
| Username sign-in always says "Wrong username or password" (email works) | Run `20261103030000_username_signin.sql` in the SQL Editor |
| "Too many attempts" | 10 wrong passwords for that username in 15 minutes; wait, or sign in with the email |
| Messages don't appear live | **Database** → **Publications** → `supabase_realtime` → make sure `messages` is on |
| "Email rate limit exceeded" on password reset | Supabase's built-in email sends only a few per hour. For real use add your own SMTP: **Authentication** → **Emails** → **SMTP Settings** |
