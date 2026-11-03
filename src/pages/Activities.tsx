import { useState, type FormEvent } from 'react';
import { useUser } from '../auth/AuthContext';
import { Empty, ErrorNote, Loading, PageHeader } from '../components/ui';
import { createActivity, deleteActivity, joinActivity, leaveActivity, listActivities } from '../data/activities';
import { confirmDelete, isStaff } from '../lib/format';
import { useAction, useLoad } from '../lib/useLoad';

export default function Activities() {
  const user = useUser();
  const staff = isStaff(user.role);
  const { data: activities = [], loading, error, reload } = useLoad(listActivities, []);
  const [showForm, setShowForm] = useState(false);
  const action = useAction();

  const mine = activities.filter((a) => a.members.some((m) => m.user_id === user.id) || a.leader_id === user.id);
  const others = activities.filter((a) => !mine.includes(a));

  async function act(fn: () => Promise<void>) {
    if (await action.run(fn)) await reload();
  }

  function card(a: (typeof activities)[number]) {
    const joined = a.members.some((m) => m.user_id === user.id);
    const leads = a.leader_id === user.id || user.role === 'admin';
    return (
      <li key={a.id} className="panel activity">
        <div className="submission-head">
          <h3>{a.name}</h3>
          <span className="badge">{a.members.length} {a.members.length === 1 ? 'member' : 'members'}</span>
        </div>
        {a.meets && <p className="activity-meets">{a.meets}</p>}
        {a.description && <p className="announcement-text">{a.description}</p>}
        <small className="hint">Run by {a.leader?.full_name ?? '—'}</small>
        {leads && a.members.length > 0 && (
          <details className="roster">
            <summary>Members</summary>
            <ul>
              {a.members.map((m) => (
                <li key={m.user_id}>{m.profile?.full_name ?? 'Unknown'}</li>
              ))}
            </ul>
          </details>
        )}
        <div className="form-actions">
          {a.leader_id !== user.id &&
            (joined ? (
              <button type="button" className="btn" disabled={action.busy} onClick={() => act(() => leaveActivity(a.id, user.id))}>
                Leave
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={action.busy} onClick={() => act(() => joinActivity(a.id, user.id))}>
                Join
              </button>
            ))}
          {leads && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => confirmDelete(`"${a.name}"`) && act(() => deleteActivity(a.id))}
            >
              Delete
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <section className="page">
      <PageHeader title="Activities">
        {staff && !showForm && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>New activity</button>
        )}
      </PageHeader>

      {showForm && (
        <NewActivity
          onDone={async () => {
            setShowForm(false);
            await reload();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <ErrorNote error={action.error ?? error} />
      {loading && activities.length === 0 ? (
        <Loading />
      ) : activities.length === 0 ? (
        <Empty>No activities yet.</Empty>
      ) : (
        <>
          <h2 className="section-title">Yours</h2>
          {mine.length === 0 ? <Empty>You haven't joined any activities yet.</Empty> : <ul className="card-grid">{mine.map(card)}</ul>}
          {others.length > 0 && (
            <>
              <h2 className="section-title">All activities</h2>
              <ul className="card-grid">{others.map(card)}</ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

function NewActivity({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const action = useAction();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;
    if (await action.run(() => createActivity({ name: get('name'), meets: get('meets'), description: get('description') }))) {
      onDone();
    }
  }

  return (
    <form className="panel stack" onSubmit={handleSubmit}>
      <h2 className="panel-title">New activity</h2>
      <label className="field">
        Name
        <input name="name" maxLength={120} required />
      </label>
      <label className="field">
        When and where <span className="optional">(optional)</span>
        <input name="meets" maxLength={120} placeholder="e.g. Tuesdays 3–5pm, Hall" />
      </label>
      <label className="field">
        Description <span className="optional">(optional)</span>
        <textarea name="description" maxLength={5000} />
      </label>
      <ErrorNote error={action.error} />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={action.busy}>Create</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
