import { useState, type FormEvent } from 'react';
import { useUser } from '../auth/AuthContext';
import { ClassPicker, Empty, ErrorNote, Loading, PageHeader } from '../components/ui';
import { listMembers } from '../data/classes';
import { listClassReports, listMyReports, saveReport } from '../data/reports';
import type { ClassMember, Report } from '../data/types';
import { formatDate, isStaff } from '../lib/format';
import { useAction, useLoad } from '../lib/useLoad';

export default function Reports() {
  const user = useUser();
  return isStaff(user.role) ? <WriteReports /> : <MyReports />;
}

function WriteReports() {
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState('');
  const [termInput, setTermInput] = useState('');

  const { data, loading, error, reload } = useLoad(async () => {
    if (!classId || !term) return null;
    const [members, reports] = await Promise.all([listMembers(classId), listClassReports(classId, term)]);
    return { members, reports };
  }, [classId, term]);

  return (
    <section className="page">
      <PageHeader title="School reports" />
      <form
        className="field-row"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(termInput.trim());
        }}
      >
        <ClassPicker teachingOnly value={classId} onChange={setClassId} />
        <label className="field">
          Term
          <input value={termInput} onChange={(e) => setTermInput(e.target.value)} placeholder="e.g. Term 1" maxLength={40} required />
        </label>
        <button type="submit" className="btn btn-primary field-row-button">Open</button>
      </form>

      <ErrorNote error={error} />
      {!term ? (
        <Empty>Pick a class and type the term to write reports.</Empty>
      ) : loading && !data ? (
        <Loading />
      ) : !data || data.members.length === 0 ? (
        <Empty>No students in this class yet.</Empty>
      ) : (
        <ul className="submission-list">
          {data.members.map((m) => (
            <ReportRow
              key={`${classId}-${m.profile.id}-${term}`}
              member={m}
              classId={classId}
              term={term}
              report={data.reports.find((r) => r.student_id === m.profile.id)}
              onSaved={reload}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReportRow({
  member,
  classId,
  term,
  report,
  onSaved,
}: {
  member: ClassMember;
  classId: string;
  term: string;
  report: Report | undefined;
  onSaved: () => void;
}) {
  const action = useAction();
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const ok = await action.run(() =>
      saveReport({
        studentId: member.profile.id,
        classId,
        term,
        grade: (form.elements.namedItem('grade') as HTMLInputElement).value,
        comment: (form.elements.namedItem('comment') as HTMLTextAreaElement).value,
        published: (form.elements.namedItem('published') as HTMLInputElement).checked,
      }),
    );
    if (ok) {
      setSaved(true);
      onSaved();
    }
  }

  return (
    <li className="panel">
      <form className="stack" onSubmit={handleSubmit} onChange={() => setSaved(false)}>
        <div className="submission-head">
          <strong>{member.profile.full_name || member.profile.username}</strong>
          <span className={`badge ${report?.published ? 'badge-good' : 'badge-neutral'}`}>
            {report ? (report.published ? 'Published' : 'Draft') : 'Not started'}
          </span>
        </div>
        <div className="grade-form">
          <label className="field">
            Grade
            <input name="grade" defaultValue={report?.grade ?? ''} maxLength={20} />
          </label>
          <label className="field grow">
            Comment
            <textarea name="comment" defaultValue={report?.comment ?? ''} maxLength={5000} />
          </label>
        </div>
        <div className="form-actions">
          <label className="check">
            <input name="published" type="checkbox" defaultChecked={report?.published ?? false} /> Visible to the student
          </label>
          <button type="submit" className="btn btn-primary" disabled={action.busy}>Save</button>
          {saved && <span className="notice-inline" role="status">Saved</span>}
        </div>
        <ErrorNote error={action.error} />
      </form>
    </li>
  );
}

function MyReports() {
  const user = useUser();
  const { data: reports = [], loading, error } = useLoad(() => listMyReports(user.id), [user.id]);

  const terms = [...new Set(reports.map((r) => r.term))];

  return (
    <section className="page">
      <PageHeader title="My reports" />
      <ErrorNote error={error} />
      {loading && reports.length === 0 ? (
        <Loading />
      ) : reports.length === 0 ? (
        <Empty>No reports have been published for you yet.</Empty>
      ) : (
        terms.map((term) => (
          <section key={term}>
            <h2 className="section-title">{term}</h2>
            <ul className="submission-list">
              {reports
                .filter((r) => r.term === term)
                .map((r) => (
                  <li key={r.id} className="panel">
                    <div className="submission-head">
                      <strong>{r.class?.name}</strong>
                      {r.grade && <span className="badge badge-good">{r.grade}</span>}
                    </div>
                    {r.comment && <p className="announcement-text">{r.comment}</p>}
                    <small className="hint">Updated {formatDate(r.updated_at)}</small>
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
