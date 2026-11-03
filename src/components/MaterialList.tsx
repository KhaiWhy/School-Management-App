import { useState, type FormEvent } from 'react';
import { useUser } from '../auth/AuthContext';
import { addMaterial, deleteMaterial, listMaterials } from '../data/coursework';
import { ACCEPTED_FILES, MAX_FILE_MB, openClassFile } from '../data/files';
import { confirmDelete, formatDate } from '../lib/format';
import { useAction, useLoad } from '../lib/useLoad';
import Icon from './Icon';
import { ClassPicker, Empty, ErrorNote, Loading } from './ui';

export default function MaterialList({ classId, canAdd }: { classId?: string; canAdd: boolean }) {
  const user = useUser();
  const { data: materials = [], loading, error, reload } = useLoad(() => listMaterials(classId), [classId]);
  const [showForm, setShowForm] = useState(false);
  const action = useAction();

  return (
    <div>
      {canAdd &&
        (showForm ? (
          <NewMaterial
            classId={classId}
            onDone={async () => {
              setShowForm(false);
              await reload();
            }}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
            Add material
          </button>
        ))}

      <ErrorNote error={action.error ?? error} />
      {loading && materials.length === 0 ? (
        <Loading />
      ) : materials.length === 0 ? (
        <Empty>No materials yet.</Empty>
      ) : (
        <ul className="item-list">
          {materials.map((m) => (
            <li key={m.id} className="item-row">
              <span className="item-icon"><Icon name="file" /></span>
              <span className="item-main">
                <strong>{m.title}</strong>
                {m.description && <span className="item-text">{m.description}</span>}
                <small>
                  {!classId && m.class?.name ? `${m.class.name} · ` : ''}
                  {formatDate(m.created_at)}
                </small>
                <span className="item-links">
                  {m.file_path && (
                    <button type="button" className="link-button" onClick={() => action.run(() => openClassFile(m.file_path!))}>
                      Open {m.file_name ?? 'file'}
                    </button>
                  )}
                  {m.link_url && (
                    <a href={m.link_url} target="_blank" rel="noopener noreferrer">
                      Open link
                    </a>
                  )}
                </span>
              </span>
              {(m.uploaded_by === user.id || user.role === 'admin') && (
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={async () => {
                    if (confirmDelete(`"${m.title}"`) && (await action.run(() => deleteMaterial(m)))) await reload();
                  }}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewMaterial({ classId, onDone, onCancel }: { classId?: string; onDone: () => void; onCancel: () => void }) {
  const [pickedClass, setPickedClass] = useState(classId ?? '');
  const action = useAction();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;
    const file = (form.elements.namedItem('file') as HTMLInputElement).files?.[0] ?? null;
    if (!file && !get('link').trim()) {
      action.setError('Add a file or a link.');
      return;
    }
    const ok = await action.run(() =>
      addMaterial({ classId: pickedClass, title: get('title'), description: get('description'), link: get('link'), file }),
    );
    if (ok) onDone();
  }

  return (
    <form className="panel stack" onSubmit={handleSubmit}>
      <h2 className="panel-title">Add material</h2>
      {!classId && <ClassPicker teachingOnly value={pickedClass} onChange={setPickedClass} />}
      <label className="field">
        Title
        <input name="title" maxLength={200} required />
      </label>
      <label className="field">
        Description <span className="optional">(optional)</span>
        <textarea name="description" maxLength={5000} />
      </label>
      <label className="field">
        File <span className="optional">(up to {MAX_FILE_MB} MB)</span>
        <input name="file" type="file" accept={ACCEPTED_FILES} />
      </label>
      <label className="field">
        Or a link <span className="optional">(optional)</span>
        <input name="link" type="url" placeholder="https://" pattern="https?://.+" />
      </label>
      <ErrorNote error={action.error} />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={action.busy || !pickedClass}>
          {action.busy ? 'Uploading…' : 'Add'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
