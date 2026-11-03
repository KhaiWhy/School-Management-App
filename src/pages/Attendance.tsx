import { useEffect, useState } from 'react';
import { useUser } from '../auth/AuthContext';
import { ClassPicker, Empty, ErrorNote, Loading, PageHeader } from '../components/ui';
import { listClassAttendance, listMyAttendance, saveAttendance } from '../data/attendance';
import { listMembers } from '../data/classes';
import type { AttendanceStatus } from '../data/types';
import { formatDate, isStaff, today } from '../lib/format';
import { useAction, useLoad } from '../lib/useLoad';

const STATUSES: { id: AttendanceStatus; label: string }[] = [
  { id: 'present', label: 'Present' },
  { id: 'late', label: 'Late' },
  { id: 'absent', label: 'Absent' },
  { id: 'excused', label: 'Excused' },
];

export default function Attendance() {
  const user = useUser();
  return isStaff(user.role) ? <TakeRegister /> : <MyAttendance />;
}

function TakeRegister() {
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(today());
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [saved, setSaved] = useState(false);
  const action = useAction();

  const { data, loading, error } = useLoad(async () => {
    if (!classId) return null;
    const [members, records] = await Promise.all([listMembers(classId), listClassAttendance(classId, date)]);
    return { members, records };
  }, [classId, date]);

  useEffect(() => {
    setMarks(Object.fromEntries((data?.records ?? []).map((r) => [r.student_id, r.status])));
    setSaved(false);
  }, [data]);

  const members = data?.members ?? [];
  const unmarked = members.filter((m) => !marks[m.profile.id]).length;

  async function save() {
    const list = Object.entries(marks).map(([studentId, status]) => ({ studentId, status }));
    if (await action.run(() => saveAttendance(classId, date, list))) setSaved(true);
  }

  return (
    <section className="page">
      <PageHeader title="Attendance" />
      <div className="field-row">
        <ClassPicker teachingOnly value={classId} onChange={setClassId} />
        <label className="field">
          Date
          <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
      </div>

      <ErrorNote error={action.error ?? error} />
      {!classId ? null : loading && !data ? (
        <Loading />
      ) : members.length === 0 ? (
        <Empty>No students in this class yet.</Empty>
      ) : (
        <>
          <div className="register-tools">
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                setMarks((m) => ({ ...Object.fromEntries(members.map((x) => [x.profile.id, 'present' as const])), ...m }));
                setSaved(false);
              }}
            >
              Mark the rest present
            </button>
            <small className="hint">{unmarked ? `${unmarked} not marked` : 'Everyone marked'}</small>
          </div>
          <ul className="register">
            {members.map(({ profile }) => (
              <li key={profile.id}>
                <span className="register-name">{profile.full_name || profile.username}</span>
                <fieldset className="status-picker">
                  <legend className="visually-hidden">Attendance for {profile.full_name}</legend>
                  {STATUSES.map((s) => (
                    <label key={s.id} className={marks[profile.id] === s.id ? `is-active status-${s.id}` : ''}>
                      <input
                        type="radio"
                        name={`status-${profile.id}`}
                        value={s.id}
                        checked={marks[profile.id] === s.id}
                        onChange={() => {
                          setMarks((m) => ({ ...m, [profile.id]: s.id }));
                          setSaved(false);
                        }}
                      />
                      {s.label}
                    </label>
                  ))}
                </fieldset>
              </li>
            ))}
          </ul>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={save} disabled={action.busy || Object.keys(marks).length === 0}>
              {action.busy ? 'Saving…' : 'Save register'}
            </button>
            {saved && <span className="notice-inline" role="status">Saved for {formatDate(date)}.</span>}
          </div>
        </>
      )}
    </section>
  );
}

function MyAttendance() {
  const user = useUser();
  const { data: records = [], loading, error } = useLoad(() => listMyAttendance(user.id), [user.id]);

  const totals = STATUSES.map((s) => ({ ...s, count: records.filter((r) => r.status === s.id).length }));
  const attended = records.filter((r) => r.status === 'present' || r.status === 'late').length;

  return (
    <section className="page">
      <PageHeader title="My attendance" />
      <ErrorNote error={error} />
      {loading && records.length === 0 ? (
        <Loading />
      ) : records.length === 0 ? (
        <Empty>No attendance has been taken for you yet.</Empty>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat">
              <strong>{Math.round((attended / records.length) * 100)}%</strong>
              <small>attended</small>
            </div>
            {totals.map((t) => (
              <div key={t.id} className="stat">
                <strong>{t.count}</strong>
                <small>{t.label.toLowerCase()}</small>
              </div>
            ))}
          </div>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Class</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.on_date)}</td>
                  <td>{r.class?.name}</td>
                  <td><span className={`badge status-${r.status}`}>{STATUSES.find((s) => s.id === r.status)?.label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
