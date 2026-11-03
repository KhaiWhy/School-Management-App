import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import Announcements from '../components/Announcements';
import AssignmentList from '../components/AssignmentList';
import Avatar from '../components/Avatar';
import { useClasses } from '../components/Layout';
import MaterialList from '../components/MaterialList';
import { Empty, ErrorNote, Loading } from '../components/ui';
import { deleteClass, getClass, listMembers, removeMember } from '../data/classes';
import type { ClassRoom } from '../data/types';
import { listSlots } from '../data/schedule';
import type { TimetableSlot } from '../data/types';
import { WEEKDAYS, confirmDelete, formatTime } from '../lib/format';
import { useAction, useLoad } from '../lib/useLoad';
import NotFound from './NotFound';

const TABS = [
  { id: 'stream', label: 'Stream' },
  { id: 'work', label: 'Assignments' },
  { id: 'materials', label: 'Materials' },
  { id: 'people', label: 'People' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function Classroom() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const user = useUser();
  const { data: room, loading, error } = useLoad(() => getClass(id), [id]);
  const { data: slots = [] } = useLoad(listSlots, []);
  const next = nextLesson(slots.filter((s) => s.class_id === id));

  const tab: TabId = TABS.some((t) => t.id === params.get('tab')) ? (params.get('tab') as TabId) : 'stream';

  if (loading && !room) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  if (!room) return <NotFound />;

  const teaches = room.teacher_id === user.id || user.role === 'admin';

  return (
    <section className="page page-wide">
      <div className="class-banner">
        <div>
          <h1 className="page-title">{room.name}</h1>
          <p className="class-banner-meta">
            {[room.subject, room.teacher?.full_name].filter(Boolean).join(' · ')}
          </p>
          {next && (
            <p className="class-banner-next">
              <span>Next lesson</span>
              <span>· {next.when} {formatTime(next.slot.starts_at)}–{formatTime(next.slot.ends_at)}</span>
              {next.slot.room && <span>· Room {next.slot.room}</span>}
            </p>
          )}
        </div>
        {teaches && (
          <JoinCode code={room.join_code} />
        )}
      </div>

      <div className="tabs" role="tablist" aria-label="Class sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams(t.id === 'stream' ? {} : { tab: t.id }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'stream' && <Announcements classId={room.id} canPost={teaches} heading="Class stream" />}
        {tab === 'work' && <AssignmentList classId={room.id} canCreate={teaches} />}
        {tab === 'materials' && <MaterialList classId={room.id} canAdd={teaches} />}
        {tab === 'people' && <People room={room} teaches={teaches} />}
      </div>
    </section>
  );
}

// The class's next lesson from now: later today, or the next day it meets.
function nextLesson(slots: TimetableSlot[]) {
  if (slots.length === 0) return null;
  const now = new Date();
  const today = ((now.getDay() + 6) % 7) + 1;
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  for (let i = 0; i < 8; i++) {
    const d = ((today - 1 + i) % 7) + 1;
    const found = slots
      .filter((s) => s.weekday === d && (i > 0 || s.ends_at.slice(0, 5) > hhmm))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    if (found) {
      const when = i === 0 ? (found.starts_at.slice(0, 5) <= hhmm ? 'Now' : 'Today') : i === 1 ? 'Tomorrow' : WEEKDAYS[d - 1];
      return { slot: found, when };
    }
  }
  return null;
}

// The code students type on their Classes page, with a one-tap copy.
function JoinCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the code is on screen to copy by hand.
    }
  }
  return (
    <div className="join-code">
      <span>Class code</span>
      <strong>{code}</strong>
      <button type="button" className="join-code-copy" onClick={copy} aria-label={`Copy class code ${code}`}>
        {copied ? 'Copied' : 'Copy'}
      </button>
      <span className="visually-hidden" role="status">{copied ? 'Class code copied' : ''}</span>
    </div>
  );
}

function People({ room, teaches }: { room: ClassRoom; teaches: boolean }) {
  const user = useUser();
  const navigate = useNavigate();
  const { reloadClasses } = useClasses();
  const { data: members = [], loading, error, reload } = useLoad(() => listMembers(room.id), [room.id]);
  const action = useAction();

  async function remove(userId: string, name: string) {
    if (!window.confirm(`Remove ${name} from ${room.name}?`)) return;
    if (await action.run(() => removeMember(room.id, userId))) await reload();
  }

  async function leave() {
    if (!window.confirm(`Leave ${room.name}? You'll need the class code to join again.`)) return;
    if (await action.run(() => removeMember(room.id, user.id))) {
      await reloadClasses();
      navigate('/classes');
    }
  }

  async function removeClass() {
    if (!confirmDelete(`${room.name} and all its posts, work, materials and attendance`)) return;
    if (await action.run(() => deleteClass(room.id))) {
      await reloadClasses();
      navigate('/classes');
    }
  }

  return (
    <div>
      <h2 className="section-title">Teacher</h2>
      <p>{room.teacher?.full_name ?? '—'}</p>

      <h2 className="section-title">Students ({members.length})</h2>
      {teaches && (
        <p className="hint">
          Students join with the class code <strong>{room.join_code}</strong> on their Classes page.
        </p>
      )}
      <ErrorNote error={action.error ?? error} />
      {loading && members.length === 0 ? (
        <Loading />
      ) : members.length === 0 ? (
        <Empty>No students yet.</Empty>
      ) : (
        <ul className="people-list">
          {members.map(({ profile }) => (
            <li key={profile.id}>
              <span className="person">
                <Avatar name={profile.full_name || profile.username} size={32} />
                <span>
                  {profile.full_name || profile.username} <small>@{profile.username}</small>
                </span>
              </span>
              {teaches && (
                <button type="button" className="btn btn-small" onClick={() => remove(profile.id, profile.full_name)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="danger-zone">
        {!teaches && (
          <button type="button" className="btn btn-danger" onClick={leave}>Leave class</button>
        )}
        {teaches && (
          <button type="button" className="btn btn-danger" onClick={removeClass}>Delete class</button>
        )}
      </div>
    </div>
  );
}
