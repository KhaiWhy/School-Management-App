import { Link } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import Announcements from '../components/Announcements';
import { ErrorNote, Loading } from '../components/ui';
import { listAssignments, listSubmissions } from '../data/coursework';
import { listEvents, listSlots } from '../data/schedule';
import type { TimetableSlot } from '../data/types';
import { WEEKDAYS, formatDate, formatDue, formatTime, isStaff, today } from '../lib/format';
import { useLoad } from '../lib/useLoad';

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const todayNumber = () => ((new Date().getDay() + 6) % 7) + 1; // 1 = Monday

// Which lessons the strip shows: today's while any are left, otherwise the next school day's.
function pickDay(slots: TimetableSlot[]) {
  const t = nowHHMM();
  const day = todayNumber();
  const todays = slots.filter((s) => s.weekday === day);
  if (todays.some((s) => s.ends_at.slice(0, 5) > t)) return { label: 'Today', lessons: todays, isToday: true };
  for (let i = 1; i <= 7; i++) {
    const d = ((day - 1 + i) % 7) + 1;
    const lessons = slots.filter((s) => s.weekday === d);
    if (lessons.length) return { label: i === 1 ? 'Tomorrow' : WEEKDAYS[d - 1], lessons, isToday: false };
  }
  return null;
}

// 'next' is filled when nothing is on now; 'next-quiet' is only labelled (a lesson is on now).
type LessonState = 'now' | 'next' | 'next-quiet' | 'done' | 'later';

function lessonStates(lessons: TimetableSlot[], isToday: boolean): LessonState[] {
  const t = nowHHMM();
  let nextGiven = false;
  const onNow = isToday && lessons.some((s) => s.starts_at.slice(0, 5) <= t && t < s.ends_at.slice(0, 5));
  return lessons.map((s) => {
    if (isToday && s.ends_at.slice(0, 5) <= t) return 'done';
    if (isToday && s.starts_at.slice(0, 5) <= t) return 'now';
    if (!nextGiven) {
      nextGiven = true;
      return onNow ? 'next-quiet' : 'next';
    }
    return 'later';
  });
}

export default function Home() {
  const user = useUser();
  const staff = isStaff(user.role);
  const { data, loading, error } = useLoad(async () => {
    const [assignments, submissions, events, slots] = await Promise.all([
      listAssignments(),
      listSubmissions(),
      listEvents(),
      listSlots(),
    ]);
    const done = new Set(staff ? [] : submissions.map((s) => s.assignment_id));
    const now = Date.now();
    return {
      slots,
      dueSoon: assignments
        .filter((a) => a.due_at && new Date(a.due_at).getTime() > now && !done.has(a.id))
        .slice(0, 4),
      events: events.filter((e) => (e.ends_on ?? e.starts_on) >= today()).slice(0, 4),
      // Teachers: work handed in but not graded yet, per assignment.
      toGrade: assignments
        .map((a) => ({ a, n: submissions.filter((s) => s.assignment_id === a.id && !s.grade).length }))
        .filter((x) => x.n > 0)
        .slice(0, 5),
    };
  }, [staff]);

  const name = user.full_name || user.username;
  const strip = data ? pickDay(data.slots) : null;
  const states = strip ? lessonStates(strip.lessons, strip.isToday) : [];
  const todaysLessons = data ? data.slots.filter((s) => s.weekday === todayNumber()) : [];
  const todayCount = todaysLessons.length;

  return (
    <div className="page page-wide">
      <div className="greeting">
        <h1 className="page-title">{greeting()}, {name}</h1>
        <p className="muted">
          {formatDate(today())}
          {data && strip?.isToday && ` · ${todayCount} ${todayCount === 1 ? 'lesson' : 'lessons'} today`}
          {data && !strip?.isToday && (todayCount === 0 ? ' · No lessons today' : ' · No more lessons today')}
        </p>
      </div>

      <ErrorNote error={error} />
      {loading && !data && <Loading />}

      {strip && (
        <section className="today" aria-labelledby="today-title">
          <h2 id="today-title" className="today-title">{strip.label}</h2>
          <ul className="today-strip">
            {strip.lessons.map((s, i) => {
              const state = states[i];
              return (
                <li key={s.id}>
                  <Link to={`/classroom/${s.class_id}`} className={`lesson lesson-${state}`}>
                    <span className="lesson-time">
                      {state === 'now' && <span className="lesson-flag">Now</span>}
                      {(state === 'next' || state === 'next-quiet') && <span className="lesson-flag">Next</span>}
                      {state === 'done' && <span className="lesson-done-label">Done</span>}
                      {formatTime(s.starts_at)}–{formatTime(s.ends_at)}
                    </span>
                    <strong className="lesson-name">{s.class?.name}</strong>
                    {s.room && <span className="lesson-room">Room {s.room}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="home-grid">
        <Announcements classId={null} canPost={staff} heading="School announcements" />

        <div className="home-side">
          {staff ? (
            <>
              <section className="panel">
                <h2 className="panel-title">To grade</h2>
                {!data ? null : data.toGrade.length === 0 ? (
                  <p className="empty">Nothing waiting to be graded.</p>
                ) : (
                  <ul className="mini-list">
                    {data.toGrade.map(({ a, n }) => (
                      <li key={a.id}>
                        <Link to={`/assignments/${a.id}`}>{a.title}</Link>
                        <small>{a.class?.name} · {n} to grade</small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="panel">
                <h2 className="panel-title">Registers today</h2>
                {!data ? null : todaysLessons.length === 0 ? (
                  <p className="empty">No lessons today.</p>
                ) : (
                  <ul className="mini-list">
                    {todaysLessons.map((l) => (
                      <li key={l.id}>
                        <Link to="/attendance">{l.class?.name}</Link>
                        <small>{formatTime(l.starts_at)}–{formatTime(l.ends_at)}{l.room ? ` · Room ${l.room}` : ''}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : (
          <section className="panel">
            <h2 className="panel-title">Due soon</h2>
            {!data ? null : data.dueSoon.length === 0 ? (
              <p className="empty">Nothing due.</p>
            ) : (
              <ul className="mini-list">
                {data.dueSoon.map((a) => (
                  <li key={a.id}>
                    <Link to={`/assignments/${a.id}`}>{a.title}</Link>
                    <small>{a.class?.name} · {formatDue(a.due_at!)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          )}
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
                      <small>{formatDate(e.starts_on)}{e.ends_on && e.ends_on !== e.starts_on ? ` – ${formatDate(e.ends_on)}` : ''}</small>
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
