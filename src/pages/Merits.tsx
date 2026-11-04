import { useState, type FormEvent, type ReactNode } from 'react';
import { useUser } from '../auth/AuthContext';
import Avatar from '../components/Avatar';
import { ClassPicker, Empty, ErrorNote, Loading, PageHeader } from '../components/ui';
import { listMembers } from '../data/classes';
import { giveMerit, listMerits, removeMerit, updateMerit } from '../data/merits';
import type { Merit } from '../data/types';
import { confirmDelete, formatDate, isStaff } from '../lib/format';
import { useAction, useLoad } from '../lib/useLoad';

// Merits and demerits: teachers give them to students in their classes; students see theirs.
export default function Merits() {
  const user = useUser();
  return isStaff(user.role) ? <GiveMerits /> : <MyMerits />;
}

function Points({ value }: { value: number }) {
  const tone = value > 0 ? 'tone-good' : value < 0 ? 'tone-bad' : '';
  return <span className={`merit-points ${tone}`}>{value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0'}</span>;
}

// Type, points, reason and details: shared by the give form and the edit form.
function MeritFields({ m }: { m?: Merit }) {
  return (
    <>
      <div className="field-row">
        <label className="field">
          Type
          <select name="kind" defaultValue={m && m.points < 0 ? 'demerit' : 'merit'}>
            <option value="merit">Merit (+)</option>
            <option value="demerit">Demerit (−)</option>
          </select>
        </label>
        <label className="field">
          Points
          <select name="points" defaultValue={m ? Math.min(Math.abs(m.points), 5) : 1}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        Reason
        <input name="reason" maxLength={300} required defaultValue={m?.reason} placeholder="e.g. Helped a classmate with homework" />
      </label>
      <label className="field">
        More details (optional)
        <textarea name="details" maxLength={1000} rows={2} defaultValue={m?.details ?? ''} />
      </label>
    </>
  );
}

function readFields(form: HTMLFormElement) {
  const get = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value;
  return { points: (get('kind') === 'demerit' ? -1 : 1) * Number(get('points')), reason: get('reason'), details: get('details') };
}

function MeritRow({ m, showStudent, actions }: { m: Merit; showStudent?: boolean; actions?: ReactNode }) {
  return (
    <li className="item-row merit-row">
      <Points value={m.points} />
      <span className="item-main">
        <strong>{m.reason}</strong>
        {m.details && <span className="merit-details">{m.details}</span>}
        <small>
          {showStudent && m.student ? `${m.student.full_name || m.student.username} · ` : ''}
          {m.class?.name ? `${m.class.name} · ` : ''}
          {m.giver?.full_name ? `${m.giver.full_name} · ` : ''}
          {formatDate(m.created_at)}
          {m.updated_at ? ' · edited' : ''}
        </small>
      </span>
      {actions && <span className="row-actions">{actions}</span>}
    </li>
  );
}

function MyMerits() {
  const { data: merits = [], loading, error } = useLoad(listMerits, []);
  const total = merits.reduce((sum, m) => sum + m.points, 0);
  const given = merits.filter((m) => m.points > 0).reduce((s, m) => s + m.points, 0);
  const taken = merits.filter((m) => m.points < 0).reduce((s, m) => s - m.points, 0);

  return (
    <section className="page">
      <PageHeader title="My merits" />
      <ErrorNote error={error} />
      {loading && merits.length === 0 ? (
        <Loading />
      ) : merits.length === 0 ? (
        <Empty>No merits yet.</Empty>
      ) : (
        <>
          <p className="summary-line">
            <strong className={total > 0 ? 'tone-good' : total < 0 ? 'tone-bad' : undefined}>
              {total > 0 ? `+${total}` : total < 0 ? `−${-total}` : '0'} in total
            </strong>
            <span aria-hidden="true"> · </span>
            <span>{given} merit {given === 1 ? 'point' : 'points'}</span>
            <span aria-hidden="true"> · </span>
            <span>{taken} demerit {taken === 1 ? 'point' : 'points'}</span>
          </p>
          <ul className="item-list">
            {merits.map((m) => (
              <MeritRow key={m.id} m={m} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function GiveMerits() {
  const user = useUser();
  const [classId, setClassId] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const action = useAction();
  const { data, loading, error, reload } = useLoad(async () => {
    if (!classId) return null;
    const [members, merits] = await Promise.all([listMembers(classId), listMerits()]);
    return { members, merits: merits.filter((m) => m.class_id === classId) };
  }, [classId]);

  async function handleGive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const studentId = (form.elements.namedItem('studentId') as HTMLSelectElement).value;
    const ok = await action.run(() => giveMerit({ studentId, classId, ...readFields(form) }));
    if (ok) {
      // Back to a 1-point merit so the next entry can't go out with the last one's type and points.
      form.reset();
      (form.elements.namedItem('studentId') as HTMLSelectElement).value = studentId;
      await reload();
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const fields = readFields(event.currentTarget);
    if (await action.run(() => updateMerit(id, fields))) {
      setEditing(null);
      await reload();
    }
  }

  return (
    <section className="page">
      <PageHeader title="Merits" />
      <ClassPicker teachingOnly value={classId} onChange={setClassId} />
      <ErrorNote error={action.error ?? error} />
      {!classId ? null : loading && !data ? (
        <Loading />
      ) : !data || data.members.length === 0 ? (
        <Empty>No students in this class yet.</Empty>
      ) : (
        <>
          <form className="panel stack" onSubmit={handleGive}>
            <h2 className="panel-title">Give a merit or demerit</h2>
            <label className="field">
              Student
              <select name="studentId" required defaultValue="">
                <option value="" disabled>Choose a student</option>
                {data.members.map(({ profile }) => (
                  <option key={profile.id} value={profile.id}>{profile.full_name || profile.username}</option>
                ))}
              </select>
            </label>
            <MeritFields />
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={action.busy}>Give</button>
            </div>
          </form>

          <h2 className="section-title">This class</h2>
          {data.merits.length === 0 ? (
            <Empty>No merits yet.</Empty>
          ) : (
            <ul className="item-list">
              {data.merits.map((m) =>
                editing === m.id ? (
                  <li key={m.id} className="panel">
                    <form className="stack" onSubmit={(e) => handleSave(e, m.id)}>
                      <h3 className="panel-title">
                        Edit entry for {m.student?.full_name || m.student?.username || 'student'}
                      </h3>
                      <MeritFields m={m} />
                      <div className="form-actions">
                        <button type="submit" className="btn btn-primary" disabled={action.busy}>Save</button>
                        <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </form>
                  </li>
                ) : (
                  <MeritRow
                    key={m.id}
                    m={m}
                    showStudent
                    actions={
                      m.given_by === user.id && (
                        <>
                          <button type="button" className="btn btn-small" onClick={() => setEditing(m.id)}>Edit</button>
                          <button
                            type="button"
                            className="btn btn-small"
                            onClick={async () => {
                              if (confirmDelete('this entry') && (await action.run(() => removeMerit(m.id)))) await reload();
                            }}
                          >
                            Remove
                          </button>
                        </>
                      )
                    }
                  />
                ),
              )}
            </ul>
          )}

          <h2 className="section-title">Totals</h2>
          <ul className="people-list">
            {data.members.map(({ profile }) => {
              const t = data.merits.filter((m) => m.student_id === profile.id).reduce((s, m) => s + m.points, 0);
              return (
                <li key={profile.id}>
                  <span className="person">
                    <Avatar name={profile.full_name || profile.username} size={28} />
                    <span>{profile.full_name || profile.username}</span>
                  </span>
                  <Points value={t || 0} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
