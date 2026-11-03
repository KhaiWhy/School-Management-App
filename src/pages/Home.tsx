import { Link } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import Announcements from '../components/Announcements';
import { listAssignments, listSubmissions } from '../data/coursework';
import { listEvents } from '../data/schedule';
import { formatDate, formatDateTime, isStaff, today } from '../lib/format';
import { useLoad } from '../lib/useLoad';

export default function Home() {
  const user = useUser();
  const staff = isStaff(user.role);
  const { data } = useLoad(async () => {
    const [assignments, submissions, events] = await Promise.all([
      listAssignments(),
      staff ? Promise.resolve([]) : listSubmissions(),
      listEvents(),
    ]);
    const done = new Set(submissions.map((s) => s.assignment_id));
    const now = Date.now();
    return {
      dueSoon: assignments
        .filter((a) => a.due_at && new Date(a.due_at).getTime() > now && !done.has(a.id))
        .slice(0, 4),
      events: events.filter((e) => (e.ends_on ?? e.starts_on) >= today()).slice(0, 4),
    };
  }, [staff]);

  return (
    <div className="page page-wide">
      <p className="greeting">Hello, {user.full_name || user.username}</p>
      <h1 className="page-title">Home</h1>

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
                  <li key={e.id}>
                    <Link to="/calendar">{e.title}</Link>
                    <small>{formatDate(e.starts_on)}</small>
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
