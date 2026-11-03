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
          <li><strong>Your account:</strong> full name, email, password (stored scrambled; nobody can read it), username and role (student, teacher or admin).</li>
          <li><strong>Your classes:</strong> which classes you teach or have joined.</li>
          <li><strong>School work:</strong> announcements, assignments, the answers and files you hand in, grades and feedback, class materials.</li>
          <li><strong>Records:</strong> attendance marks and term reports.</li>
          <li><strong>Other:</strong> your messages, the activities you join, timetable lessons and calendar events.</li>
        </ul>

        <h2 className="section-title">Who can see it</h2>
        <ul className="privacy-list">
          <li>Other signed-in users can see your name, username and role. <strong>Your email is never shown to other users.</strong></li>
          <li>Classmates see each other in the class list. They can't see each other's work, grades, attendance or reports.</li>
          <li>Teachers see the work, attendance and reports of students in the classes they teach. Students see a report only once their teacher publishes it.</li>
          <li>Messages can only be read by the two people in the chat.</li>
          <li>The school's Schooling admin can change who is a teacher or admin.</li>
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
          Schooling has no adverts, analytics or tracking. Your browser stores your sign-in, so you stay signed in, and
          your light or dark mode choice. Nothing else.
        </p>

        <h2 className="section-title">Your choices</h2>
        <ul className="privacy-list">
          <li>Change your name, username or password on your Profile page.</li>
          <li>You can withdraw work you handed in until it has been graded.</li>
          <li>To get a copy of your data, or to delete your account and everything in it, ask your school's Schooling admin.</li>
        </ul>
      </article>
    </main>
  );
}
