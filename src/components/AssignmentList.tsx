import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import { createAssignment, listAssignments, listSubmissions } from '../data/coursework';
import type { Assignment, Submission } from '../data/types';
import { formatDateTime, localInputToIso } from '../lib/format';
import { useAction, useLoad } from '../lib/useLoad';
import { ClassPicker, Empty, ErrorNote, Loading } from './ui';

function status(a: Assignment, mine: Submission | undefined) {
  if (mine?.grade) return { label: `Graded: ${mine.grade}`, tone: 'good' };
  if (mine) return { label: 'Handed in', tone: 'good' };
  if (a.due_at && new Date(a.due_at).getTime() < Date.now()) return { label: 'Missing', tone: 'bad' };
  return { label: 'To do', tone: 'neutral' };
}

// classId given = one class (classroom tab); otherwise every class you're in.
export default function AssignmentList({ classId, canCreate }: { classId?: string; canCreate: boolean }) {
  const user = useUser();
  const isStudent = user.role === 'student';
  const { data, loading, error, reload } = useLoad(async () => {
    const [assignments, submissions] = await Promise.all([listAssignments(classId), listSubmissions()]);
    return { assignments, submissions };
  }, [classId]);
  const [showForm, setShowForm] = useState(false);

  const assignments = data?.assignments ?? [];
  const mine = new Map((data?.submissions ?? []).filter((s) => s.student_id === user.id).map((s) => [s.assignment_id, s]));
  const handedIn = new Map<string, number>();
  for (const s of data?.submissions ?? []) handedIn.set(s.assignment_id, (handedIn.get(s.assignment_id) ?? 0) + 1);

  return (
    <div>
      {canCreate &&
        (showForm ? (
          <NewAssignment
            classId={classId}
            onDone={async () => {
              setShowForm(false);
              await reload();
            }}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
            New assignment
          </button>
        ))}

      <ErrorNote error={error} />
      {loading && !data ? (
        <Loading />
      ) : assignments.length === 0 ? (
        <Empty>No assignments yet.</Empty>
      ) : (
        <ul className="item-list">
          {assignments.map((a) => {
            const s = status(a, mine.get(a.id));
            return (
              <li key={a.id}>
                <Link to={`/assignments/${a.id}`} className="item-row">
                  <span className="item-main">
                    <strong>{a.title}</strong>
                    <small>
                      {!classId && a.class?.name ? `${a.class.name} · ` : ''}
                      {a.due_at ? `Due ${formatDateTime(a.due_at)}` : 'No due date'}
                    </small>
                  </span>
                  {isStudent ? (
                    <span className={`badge badge-${s.tone}`}>{s.label}</span>
                  ) : (
                    <span className="badge">{handedIn.get(a.id) ?? 0} handed in</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NewAssignment({
  classId,
  onDone,
  onCancel,
}: {
  classId?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pickedClass, setPickedClass] = useState(classId ?? '');
  const action = useAction();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;
    const ok = await action.run(() =>
      createAssignment({
        classId: pickedClass,
        title: get('title'),
        description: get('description'),
        dueAt: localInputToIso(get('due')),
      }),
    );
    if (ok) onDone();
  }

  return (
    <form className="panel stack" onSubmit={handleSubmit}>
      <h2 className="panel-title">New assignment</h2>
      {!classId && <ClassPicker teachingOnly value={pickedClass} onChange={setPickedClass} />}
      <label className="field">
        Title
        <input name="title" maxLength={200} required />
      </label>
      <label className="field">
        Instructions <span className="optional">(optional)</span>
        <textarea name="description" maxLength={10000} />
      </label>
      <label className="field">
        Due <span className="optional">(optional)</span>
        <input name="due" type="datetime-local" />
      </label>
      <ErrorNote error={action.error} />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={action.busy || !pickedClass}>
          Post assignment
        </button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
