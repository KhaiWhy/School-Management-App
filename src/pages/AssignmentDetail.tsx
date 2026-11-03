import { type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import { Empty, ErrorNote, Loading } from '../components/ui';
import { listMembers } from '../data/classes';
import {
  deleteAssignment,
  getAssignment,
  gradeSubmission,
  listSubmissions,
  submitWork,
  withdrawSubmission,
} from '../data/coursework';
import { MAX_FILE_MB, openClassFile } from '../data/files';
import type { Assignment, Submission } from '../data/types';
import { confirmDelete, formatDateTime } from '../lib/format';
import { useAction, useLoad } from '../lib/useLoad';
import NotFound from './NotFound';

export default function AssignmentDetail() {
  const { id = '' } = useParams();
  const user = useUser();
  const navigate = useNavigate();
  const action = useAction();
  const { data: assignment, loading, error } = useLoad(() => getAssignment(id), [id]);

  if (loading && !assignment) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  if (!assignment) return <NotFound />;

  const teaches = assignment.class?.teacher_id === user.id || user.role === 'admin';
  const late = assignment.due_at && new Date(assignment.due_at).getTime() < Date.now();

  async function remove() {
    if (!confirmDelete(`"${assignment!.title}" and every submission for it`)) return;
    if (await action.run(() => deleteAssignment(assignment!.id))) {
      navigate(`/classroom/${assignment!.class_id}?tab=work`);
    }
  }

  return (
    <section className="page">
      <p className="breadcrumb">
        <Link to={`/classroom/${assignment.class_id}?tab=work`}>{assignment.class?.name ?? 'Class'}</Link> / Assignment
      </p>
      <h1 className="page-title">{assignment.title}</h1>
      <p className={late ? 'due due-late' : 'due'}>
        {assignment.due_at ? `Due ${formatDateTime(assignment.due_at)}` : 'No due date'}
      </p>
      {assignment.description && <p className="announcement-text">{assignment.description}</p>}

      <ErrorNote error={action.error} />
      {teaches ? <ClassSubmissions assignment={assignment} /> : <MyWork assignment={assignment} />}

      {teaches && (
        <div className="danger-zone">
          <button type="button" className="btn btn-danger" onClick={remove}>Delete assignment</button>
        </div>
      )}
    </section>
  );
}

function FileButton({ submission }: { submission: Submission }) {
  const action = useAction();
  if (!submission.file_path) return null;
  return (
    <>
      <button type="button" className="link-button" onClick={() => action.run(() => openClassFile(submission.file_path!))}>
        Open {submission.file_name ?? 'file'}
      </button>
      <ErrorNote error={action.error} />
    </>
  );
}

function MyWork({ assignment }: { assignment: Assignment }) {
  const user = useUser();
  const { data, loading, error, reload } = useLoad(() => listSubmissions(assignment.id), [assignment.id]);
  const action = useAction();
  const mine = data?.find((s) => s.student_id === user.id) ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = (form.elements.namedItem('body') as HTMLTextAreaElement).value;
    const fileInput = form.elements.namedItem('file') as HTMLInputElement;
    const file = fileInput.files?.[0] ?? null;
    if (!body.trim() && !file && !mine?.file_path) {
      action.setError('Write an answer or attach a file.');
      return;
    }
    if (await action.run(() => submitWork({ assignment, studentId: user.id, body, file, previous: mine }))) {
      fileInput.value = '';
      await reload();
    }
  }

  async function withdraw() {
    if (!mine || !window.confirm('Withdraw your work? You can hand it in again.')) return;
    if (await action.run(() => withdrawSubmission(mine))) await reload();
  }

  if (loading && !data) return <Loading />;

  return (
    <div className="panel">
      <h2 className="panel-title">Your work</h2>
      <ErrorNote error={action.error ?? error} />

      {mine?.grade || mine?.feedback ? (
        <div className="feedback">
          {mine.grade && <p><strong>Grade:</strong> {mine.grade}</p>}
          {mine.feedback && <p className="announcement-text"><strong>Feedback:</strong> {mine.feedback}</p>}
        </div>
      ) : null}

      {mine && (
        <p className="hint">
          Handed in {formatDateTime(mine.submitted_at)}. <FileButton submission={mine} />
        </p>
      )}

      {mine?.grade ? (
        <p className="hint">This work has been graded, so it can't be changed.</p>
      ) : (
        <form className="stack" onSubmit={handleSubmit}>
          <label className="field">
            Answer <span className="optional">(optional if you attach a file)</span>
            <textarea name="body" defaultValue={mine?.body ?? ''} maxLength={20000} key={mine?.submitted_at ?? 'new'} />
          </label>
          <label className="field">
            {mine?.file_path ? 'Replace file' : 'Attach a file'} <span className="optional">(up to {MAX_FILE_MB} MB)</span>
            <input name="file" type="file" />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={action.busy}>
              {action.busy ? 'Handing in…' : mine ? 'Update' : 'Hand in'}
            </button>
            {mine && (
              <button type="button" className="btn" onClick={withdraw} disabled={action.busy}>
                Withdraw
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function ClassSubmissions({ assignment }: { assignment: Assignment }) {
  const { data, loading, error, reload } = useLoad(async () => {
    const [members, submissions] = await Promise.all([
      listMembers(assignment.class_id),
      listSubmissions(assignment.id),
    ]);
    return { members, submissions };
  }, [assignment.id, assignment.class_id]);
  const action = useAction();

  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  if (!data) return null;

  const byStudent = new Map(data.submissions.map((s) => [s.student_id, s]));
  const handedIn = data.submissions.length;

  async function handleGrade(event: FormEvent<HTMLFormElement>, submission: Submission) {
    event.preventDefault();
    const form = event.currentTarget;
    const grade = (form.elements.namedItem('grade') as HTMLInputElement).value;
    const feedback = (form.elements.namedItem('feedback') as HTMLTextAreaElement).value;
    if (await action.run(() => gradeSubmission(submission.id, grade, feedback))) await reload();
  }

  return (
    <div>
      <h2 className="section-title">
        Submissions ({handedIn} of {data.members.length})
      </h2>
      <ErrorNote error={action.error} />
      {data.members.length === 0 ? (
        <Empty>No students in this class yet.</Empty>
      ) : (
        <ul className="submission-list">
          {data.members.map(({ profile }) => {
            const s = byStudent.get(profile.id);
            return (
              <li key={profile.id} className="panel">
                <div className="submission-head">
                  <strong>{profile.full_name || profile.username}</strong>
                  <span className={`badge ${s ? (s.grade ? 'badge-good' : 'badge-neutral') : 'badge-bad'}`}>
                    {s ? (s.grade ? `Graded: ${s.grade}` : 'Handed in') : 'Not handed in'}
                  </span>
                </div>
                {s && (
                  <>
                    <small className="hint">{formatDateTime(s.submitted_at)}</small>
                    {s.body && <p className="announcement-text">{s.body}</p>}
                    <FileButton submission={s} />
                    <form className="grade-form" onSubmit={(e) => handleGrade(e, s)}>
                      <label className="field">
                        Grade
                        <input name="grade" defaultValue={s.grade ?? ''} maxLength={20} />
                      </label>
                      <label className="field grow">
                        Feedback
                        <textarea name="feedback" defaultValue={s.feedback ?? ''} maxLength={5000} />
                      </label>
                      <button type="submit" className="btn btn-primary" disabled={action.busy}>Save</button>
                    </form>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
