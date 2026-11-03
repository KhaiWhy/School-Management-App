import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import { ClassPicker, Empty, ErrorNote, Loading, PageHeader } from '../components/ui';
import { addSlot, deleteSlot, listSlots } from '../data/schedule';
import { WEEKDAYS, formatTime, isStaff } from '../lib/format';
import { useAction, useLoad } from '../lib/useLoad';

export default function Timetable() {
  const user = useUser();
  const staff = isStaff(user.role);
  const { data: slots = [], loading, error, reload } = useLoad(listSlots, []);
  const [showForm, setShowForm] = useState(false);
  const action = useAction();

  // Monday–Friday always; weekend columns only if something is on.
  const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => d <= 5 || slots.some((s) => s.weekday === d));
  const todayNumber = ((new Date().getDay() + 6) % 7) + 1;

  return (
    <section className="page page-wide">
      <PageHeader title="Timetable">
        {staff && !showForm && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>Add lesson</button>
        )}
      </PageHeader>

      {showForm && (
        <NewSlot
          onDone={async () => {
            setShowForm(false);
            await reload();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <ErrorNote error={action.error ?? error} />
      {loading && slots.length === 0 ? (
        <Loading />
      ) : slots.length === 0 ? (
        <Empty>{staff ? 'No lessons yet. Add one for each class you teach.' : 'No lessons yet. Your teachers add them to each class.'}</Empty>
      ) : (
        <div className="week">
          {days.map((day) => (
            <section key={day} className={day === todayNumber ? 'week-day is-today' : 'week-day'}>
              <h2>{WEEKDAYS[day - 1]}</h2>
              <ul>
                {slots
                  .filter((s) => s.weekday === day)
                  .map((s) => (
                    <li key={s.id} className="lesson">
                      <span className="lesson-time">{formatTime(s.starts_at)}–{formatTime(s.ends_at)}</span>
                      <Link to={`/classroom/${s.class_id}`} className="lesson-name">{s.class?.name}</Link>
                      {s.room && <span className="lesson-room">{s.room}</span>}
                      {(s.class?.teacher_id === user.id || user.role === 'admin') && (
                        <button
                          type="button"
                          className="link-button lesson-remove"
                          aria-label={`Remove ${s.class?.name} on ${WEEKDAYS[day - 1]} at ${formatTime(s.starts_at)}`}
                          onClick={async () => {
                            if (window.confirm('Remove this lesson from the timetable?') && (await action.run(() => deleteSlot(s.id)))) {
                              await reload();
                            }
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function NewSlot({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [classId, setClassId] = useState('');
  const action = useAction();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;
    if (get('ends') <= get('starts')) {
      action.setError('The lesson has to end after it starts.');
      return;
    }
    const ok = await action.run(() =>
      addSlot({ classId, weekday: Number(get('weekday')), startsAt: get('starts'), endsAt: get('ends'), room: get('room') }),
    );
    if (ok) onDone();
  }

  return (
    <form className="panel stack" onSubmit={handleSubmit}>
      <h2 className="panel-title">Add lesson</h2>
      <ClassPicker teachingOnly value={classId} onChange={setClassId} />
      <div className="field-row">
        <label className="field">
          Day
          <select name="weekday" defaultValue="1">
            {WEEKDAYS.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Starts
          <input name="starts" type="time" required />
        </label>
        <label className="field">
          Ends
          <input name="ends" type="time" required />
        </label>
        <label className="field">
          Room <span className="optional">(optional)</span>
          <input name="room" maxLength={40} />
        </label>
      </div>
      <ErrorNote error={action.error} />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={action.busy || !classId}>Add</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
