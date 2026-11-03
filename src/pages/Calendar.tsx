import { useState, type FormEvent } from 'react';
import { useUser } from '../auth/AuthContext';
import { Empty, ErrorNote, Loading, PageHeader } from '../components/ui';
import { addEvent, deleteEvent, listEvents } from '../data/schedule';
import type { EventCategory, SchoolEvent } from '../data/types';
import { confirmDelete, formatDate, isStaff, today } from '../lib/format';
import { useAction, useLoad } from '../lib/useLoad';

const CATEGORIES: { id: EventCategory; label: string }[] = [
  { id: 'event', label: 'Event' },
  { id: 'term', label: 'Term dates' },
  { id: 'holiday', label: 'Holiday' },
  { id: 'exam', label: 'Exam' },
];

function monthKey(date: string) {
  return date.slice(0, 7);
}

export default function Calendar() {
  const user = useUser();
  const staff = isStaff(user.role);
  const { data: events = [], loading, error, reload } = useLoad(listEvents, []);
  const [showPast, setShowPast] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const action = useAction();

  const now = today();
  const visible = events.filter((e) => showPast || (e.ends_on ?? e.starts_on) >= now);
  const months = new Map<string, SchoolEvent[]>();
  for (const e of visible) months.set(monthKey(e.starts_on), [...(months.get(monthKey(e.starts_on)) ?? []), e]);

  return (
    <section className="page">
      <PageHeader title="School calendar">
        {staff && !showForm && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>Add event</button>
        )}
      </PageHeader>

      {showForm && (
        <NewEvent
          onDone={async () => {
            setShowForm(false);
            await reload();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <label className="check">
        <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> Show past events
      </label>

      <ErrorNote error={action.error ?? error} />
      {loading && events.length === 0 ? (
        <Loading />
      ) : visible.length === 0 ? (
        <Empty>Nothing on the calendar yet.</Empty>
      ) : (
        [...months.entries()].map(([month, list]) => (
          <section key={month} className="month">
            <h2 className="section-title">{formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}</h2>
            <ul className="item-list">
              {list.map((e) => (
                <li key={e.id} className="item-row">
                  <span className="date-chip">
                    <strong>{formatDate(e.starts_on, { day: 'numeric' })}</strong>
                    <small>{formatDate(e.starts_on, { weekday: 'short' })}</small>
                  </span>
                  <span className="item-main">
                    <strong>{e.title}</strong>
                    {e.ends_on && e.ends_on !== e.starts_on && <small>Until {formatDate(e.ends_on)}</small>}
                    {e.description && <span className="item-text">{e.description}</span>}
                  </span>
                  <span className={`badge badge-${e.category}`}>{CATEGORIES.find((c) => c.id === e.category)?.label}</span>
                  {staff && (
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={async () => {
                        if (confirmDelete(`"${e.title}"`) && (await action.run(() => deleteEvent(e.id)))) await reload();
                      }}
                    >
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}

function NewEvent({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const action = useAction();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;
    if (get('ends') && get('ends') < get('starts')) {
      action.setError('The end date is before the start date.');
      return;
    }
    const ok = await action.run(() =>
      addEvent({
        title: get('title'),
        description: get('description'),
        startsOn: get('starts'),
        endsOn: get('ends'),
        category: get('category') as EventCategory,
      }),
    );
    if (ok) onDone();
  }

  return (
    <form className="panel stack" onSubmit={handleSubmit}>
      <h2 className="panel-title">Add event</h2>
      <label className="field">
        Title
        <input name="title" maxLength={200} required />
      </label>
      <div className="field-row">
        <label className="field">
          Type
          <select name="category" defaultValue="event">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Date
          <input name="starts" type="date" required />
        </label>
        <label className="field">
          Until <span className="optional">(optional)</span>
          <input name="ends" type="date" />
        </label>
      </div>
      <label className="field">
        Details <span className="optional">(optional)</span>
        <textarea name="description" maxLength={5000} />
      </label>
      <ErrorNote error={action.error} />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={action.busy}>Add</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
