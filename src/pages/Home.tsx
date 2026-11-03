import { Link } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import Announcements from '../components/Announcements';
import { listAssignments, listSubmissions } from '../data/coursework';
import { listEvents, listSlots } from '../data/schedule';
import { formatDate, formatDateTime, formatTime, isStaff, today } from '../lib/format';
import { useLoad } from '../lib/useLoad';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const user = useUser();
  const staff = isStaff(user.role);
  const { data } = useLoad(async () => {
    const [assignments, submissions, events, slots] = await Promise.all([
      listAssignments(),
      staff ? Promise.resolve([]) : listSubmissions(),
      listEvents(),
      listSlots(),
    ]);
    const done = new Set(submissions.map((s) => s.assignment_id));
    const now = Date.now();
    const weekday = ((new Date().getDay() + 6) % 7) + 1;
    return {
      lessons: slots.filter((s) => s.weekday === weekday),
      dueSoon: assignments
        .filter((a) => a.due_at && new Date(a.due_at).getTime() > now && !done.has(a.id))
        .slice(0, 4),
      events: events.filter((e) => (e.ends_on ?? e.starts_on) >= today()).slice(0, 4),
    };
  }, [staff]);

  const name = user.full_name || user.username;
  const lessonCount = data?.lessons.length ?? 0;

  return (
    <div className="page page-wide">
      <div className="greeting">
        <h1 className="page-title">{greeting()}, {name}</h1>
        <p className="muted">
          {formatDate(today(), { weekday: 'long', day: 'numeric', month: 'long' })}
          {data ? ` · ${lessonCount === 0 ? 'No lessons today' : `${lessonCount} ${lessonCount === 1 ? 'lesson' : 'lessons'} today`}` : ''}
        </p>
      </div>

      {data && data.lessons.length > 0 && (
        <ul className="today-strip" aria-label="Today's lessons">
          {data.lessons.map((s) => (
            <li key={s.id}>
              <Link to={`/classroom/${s.class_id}`} className="lesson">
                <span className="lesson-time">{formatTime(s.starts_at)}–{formatTime(s.ends_at)}</span>
                <strong className="lesson-name">{s.class?.name}</strong>
                {s.room && <span className="lesson-room">Room {s.room}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="home-grid">
        <Announcements classId={null} canPost={staff} heading="School announcements" />

        <div className="home-side">
          <section className="panel">
            <h2 className="panel-title">{staff ? 'Upcoming deadlines' : 'Due soon'}</h2>
            {!data ? null : data.dueSoon.length === 0 ? (
              <p className="empty">Nothing due.</p>
            ) : (
              <ul className="mini-list">
                {data.dueSoon.map((a) => (
                  <li key={a.id}>
                    <Link to={`/assignments/${a.id}`}>{a.title}</Link>
                    <small>{a.class?.name} · {formatDateTime(a.due_at!)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2 className="panel-title">Coming up</h2>
            {!data ? null : data.events.length === 0 ? (
              <p className="empty">No events on the calendar.</p>
            ) : (
              <ul className="mini-list">
                {data.events.map((e) => (
                  <li key={e.id} className="mini-event">
                    <span className="date-chip">
                      <strong>{formatDate(e.starts_on, { day: 'numeric' })}</strong>
                      <small>{formatDate(e.starts_on, { weekday: 'short' })}</small>
                    </span>
                    <span>
                      <Link to="/calendar">{e.title}</Link>
                      <small>{formatDate(e.starts_on, { month: 'short', day: 'numeric' })}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
