import { useState } from 'react';
import { useUser } from '../auth/AuthContext';
import { Empty, ErrorNote, Loading, PageHeader } from '../components/ui';
import { listPeople, setRole } from '../data/people';
import type { Role } from '../data/types';
import { useAction, useLoad } from '../lib/useLoad';

// Admins only: change who is a student, teacher or admin.
export default function People() {
  const user = useUser();
  const [search, setSearch] = useState('');
  const { data: people = [], loading, error, reload } = useLoad(() => listPeople(search), [search]);
  const action = useAction();

  async function change(id: string, name: string, role: Role) {
    if (!window.confirm(`Make ${name} a ${role}?`)) return;
    if (await action.run(() => setRole(id, role))) await reload();
  }

  return (
    <section className="page">
      <PageHeader title="People" />
      <p className="hint">Everyone who signs up starts as a student. Make teachers and admins here.</p>
      <label className="field">
        Search
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or username" />
      </label>
      <ErrorNote error={action.error ?? error} />
      {loading && people.length === 0 ? (
        <Loading />
      ) : people.length === 0 ? (
        <Empty>No one found.</Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Username</th>
              <th scope="col">Role</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <td>{p.full_name || '—'}</td>
                <td>@{p.username}</td>
                <td>
                  <label className="visually-hidden" htmlFor={`role-${p.id}`}>Role for {p.full_name}</label>
                  <select
                    id={`role-${p.id}`}
                    value={p.role}
                    disabled={p.id === user.id || action.busy}
                    onChange={(e) => change(p.id, p.full_name || p.username, e.target.value as Role)}
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
