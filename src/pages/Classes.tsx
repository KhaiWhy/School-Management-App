import { type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import { useClasses } from '../components/Layout';
import { Empty, ErrorNote, PageHeader } from '../components/ui';
import { createClass, joinClass } from '../data/classes';
import { isStaff } from '../lib/format';
import { useAction } from '../lib/useLoad';

export default function Classes() {
  const user = useUser();
  const { classes, reloadClasses } = useClasses();
  const navigate = useNavigate();
  const action = useAction();
  const staff = isStaff(user.role);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value;
    const subject = (form.elements.namedItem('subject') as HTMLInputElement).value;
    let id = '';
    if (await action.run(async () => ({ id } = await createClass({ name, subject })))) {
      await reloadClasses();
      navigate(`/classroom/${id}?tab=people`);
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = (event.currentTarget.elements.namedItem('code') as HTMLInputElement).value;
    let id = '';
    if (await action.run(async () => (id = await joinClass(code)))) {
      await reloadClasses();
      navigate(`/classroom/${id}`);
    }
  }

  return (
    <section className="page">
      <PageHeader title="Classes" />

      <div className="panel">
        {staff ? (
          <form className="inline-form" onSubmit={handleCreate}>
            <h2 className="panel-title">New class</h2>
            <label className="field">
              Class name
              <input name="name" placeholder="e.g. Maths 10A" maxLength={80} required />
            </label>
            <label className="field">
              Subject <span className="optional">(optional)</span>
              <input name="subject" maxLength={80} />
            </label>
            <button type="submit" className="btn btn-primary" disabled={action.busy}>Create class</button>
          </form>
        ) : (
          <form className="inline-form" onSubmit={handleJoin}>
            <h2 className="panel-title">Join a class</h2>
            <label className="field">
              Class code from your teacher
              <input
                name="code"
                placeholder="e.g. K7QW2M9P"
                autoCapitalize="characters"
                autoComplete="off"
                pattern="[A-Za-z0-9]{6,8}"
                title="The 8 letters and numbers your teacher gave you"
                required
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={action.busy}>Join</button>
          </form>
        )}
        <ErrorNote error={action.error} />
      </div>

      <h2 className="section-title">Your classes</h2>
      {classes.length === 0 ? (
        <Empty>{staff ? 'No classes yet. Create one above.' : 'No classes yet. Ask your teacher for the class code.'}</Empty>
      ) : (
        <ul className="card-grid">
          {classes.map((c) => (
            <li key={c.id}>
              <Link to={`/classroom/${c.id}`} className="class-card">
                <strong>{c.name}</strong>
                {c.subject && <span>{c.subject}</span>}
                <small>{c.teacher_id === user.id ? `You teach this · code ${c.join_code}` : c.teacher?.full_name}</small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
