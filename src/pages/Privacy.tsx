import { Link } from 'react-router-dom';

// Public page (no sign-in needed). Keep it matching what the app really stores and loads:
// supabase/migrations/*.sql (tables and access rules), index.html (Google Fonts).
export default function Privacy() {
  return (
    <main className="privacy">
      <article className="privacy-body">
        <p className="breadcrumb"><Link to="/login">Schooling</Link> / Privacy</p>
        <h1 className="page-title">Privacy</h1>
        <p className="lead">What Schooling stores about you, who can see it, and how to change or remove it.</p>

        <h2 className="section-title">What we store</h2>
        <ul className="privacy-list">
          <li><strong>Your account:</strong> full name, email, password (stored scrambled; nobody can read it), username, role (student or teacher) and your school (chosen when you sign up; after that only the admin changes it).</li>
          <li><strong>Your classes:</strong> which classes you teach or have joined.</li>
          <li><strong>School work:</strong> announcements, assignments, the answers and files you hand in, grades and feedback, class materials.</li>
          <li><strong>Records:</strong> attendance marks, term reports, and merits or demerits with their reason and any details the teacher adds.</li>
          <li><strong>Other:</strong> your messages, the activities you join, timetable lessons and calendar events.</li>
        </ul>

        <h2 className="section-title">Who can see it</h2>
        <ul className="privacy-list">
          <li>Your name, username, role and school are seen only by people you share a class or an activity with, staff at your school, and anyone you already have a conversation with. Students at your school who aren't in your classes can't see you. <strong>Your email is never shown to other users.</strong></li>
          <li>School-wide announcements, calendar events and activities are only seen at your own school. An activity's member list is seen by its members, its leader and staff at that school.</li>
          <li>Classmates see each other in the class list. They can't see each other's work, grades, attendance or reports.</li>
          <li>Teachers see the work, attendance, reports and merits of students in the classes they teach. Students see a report only once their teacher publishes it, and see their own merits.</li>
          <li>Messages can only be read by the two people in the chat. You can only start a chat with someone you can see (above).</li>
          <li>
            The school's Schooling admin (who uses a separate admin page) can see everyone's name, username and email,
            make teacher accounts, change who is a teacher, set people's school, remove students from classes, and
            reset anyone's password. A reset gives a new one-time password, so the admin could sign in as that person
            (and read their messages). It also signs that person out everywhere.
          </li>
        </ul>
        <p>These rules are built into the database itself, not only the screens.</p>

        <h2 className="section-title">Where it's kept</h2>
        <ul className="privacy-list">
          <li>The database, sign-in and uploaded files are kept with Supabase, in its Frankfurt (EU) data centre.</li>
          <li>The website is served by Render.</li>
          <li>The fonts are loaded from Google Fonts, so your browser contacts Google's servers when a page opens.</li>
        </ul>

        <h2 className="section-title">Cookies and tracking</h2>
        <p>
          Schooling has no adverts, analytics or tracking. Your browser stores your sign-in (for this tab only, or
          until you sign out if you tick Remember me), whether you ticked Remember me, and your light or dark mode
          choice. On the admin page, the passkey is kept in that browser tab until it is locked or closed.
        </p>

        <h2 className="section-title">Your choices</h2>
        <ul className="privacy-list">
          <li>Change your name, username or password on your Profile page. To change your school, ask the admin.</li>
          <li>You can withdraw work you handed in until it has been graded.</li>
          <li>To get a copy of your data, or to delete your account and everything in it, ask your school's Schooling admin. A teacher's classes have to be deleted or handed over first. Deleting a class also deletes its files.</li>
        </ul>

        <h2 className="section-title">Security logs</h2>
        <ul className="privacy-list">
          <li>Failed sign-ins with a username, wrong admin passkeys and wrong class codes are logged with the time and the network address they came from, to stop guessing. These logs are deleted after a day.</li>
          <li>When the admin makes a teacher account, the email is kept on a short list for up to an hour while the account is made.</li>
        </ul>
      </article>
    </main>
  );
}
