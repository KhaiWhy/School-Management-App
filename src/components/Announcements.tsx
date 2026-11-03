import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useUser } from '../auth/AuthContext';
import * as api from '../data/announcements';
import { confirmDelete, formatDateTime } from '../lib/format';
import { useAction, useLoad } from '../lib/useLoad';
import { ErrorNote, Loading } from './ui';

// Ported from legacy/home.html. classId null = whole school (home page), otherwise one class.

interface AnnouncementFields extends HTMLFormControlsCollection {
  title: HTMLInputElement;
  body: HTMLTextAreaElement;
}

function fields(form: HTMLFormElement) {
  return form.elements as AnnouncementFields;
}

export default function Announcements({
  classId,
  canPost,
  heading = 'Announcements',
}: {
  classId: string | null;
  canPost: boolean;
  heading?: string;
}) {
  const user = useUser();
  const { data: items = [], error, loading, reload } = useLoad(() => api.listAnnouncements(classId), [classId]);
  const action = useAction();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close an open menu when clicking anywhere else.
  useEffect(() => {
    if (openMenuId === null) return;
    function onClick(event: MouseEvent) {
      if (!(event.target instanceof Element) || !event.target.closest('.announcement-card')) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [openMenuId]);

  function focusIn(id: string, selector: string) {
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"] ${selector}`)
        ?.focus();
    });
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = fields(form).title.value.trim();
    const body = fields(form).body.value.trim();
    if (!title || !body) return;
    const saved = await action.run(() => api.createAnnouncement(classId, { title, body }));
    if (saved) {
      form.reset();
      await reload();
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const { title: titleInput, body: bodyInput } = fields(event.currentTarget);
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    if (!title) {
      titleInput.value = '';
      titleInput.reportValidity();
      return;
    }
    if (!body) {
      bodyInput.value = '';
      bodyInput.reportValidity();
      return;
    }
    if (await action.run(() => api.updateAnnouncement(id, { title, body }))) {
      setEditingId(null);
      await reload();
      focusIn(id, '.more-options-btn');
    }
  }

  async function handleDelete(id: string, title: string) {
    setOpenMenuId(null);
    if (!confirmDelete(`"${title}"`)) {
      focusIn(id, '.more-options-btn');
      return;
    }
    if (await action.run(() => api.deleteAnnouncement(id))) {
      setEditingId(null);
      await reload();
    }
  }

  function toggleMenu(id: string) {
    const opening = openMenuId !== id;
    setOpenMenuId(opening ? id : null);
    focusIn(id, opening ? '[role="menuitem"]' : '.more-options-btn');
  }

  function handleMenuKeys(event: KeyboardEvent<HTMLDivElement>, id: string) {
    const options = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    );
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpenMenuId(null);
      focusIn(id, '.more-options-btn');
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      options[(current + step + options.length) % options.length].focus();
    }
  }

  const formId = classId ? `class-${classId}` : 'school';

  return (
    <section className="announcements" aria-labelledby={`${formId}-announcements`}>
      <h2 id={`${formId}-announcements`} className="section-title">{heading}</h2>

      {canPost && (
        <form className="announcement-form" onSubmit={handleCreate}>
          <label className="visually-hidden" htmlFor={`${formId}-title`}>Title</label>
          <input id={`${formId}-title`} name="title" placeholder="Write your title here..." maxLength={200} required />
          <label className="visually-hidden" htmlFor={`${formId}-body`}>Announcement</label>
          <textarea id={`${formId}-body`} name="body" placeholder="Write your announcement here..." maxLength={10000} required />
          <button type="submit" className="btn btn-primary" disabled={action.busy}>
            {action.busy ? 'Posting…' : 'Add announcement'}
          </button>
        </form>
      )}

      <ErrorNote error={action.error ?? error} />

      {loading && items.length === 0 ? (
        <Loading />
      ) : items.length === 0 ? (
        <p className="empty">No announcements yet.</p>
      ) : (
        <div ref={listRef}>
          {items.map((item) => {
            const canManage = item.author_id === user.id || user.role === 'admin';
            const edited = item.updated_at !== item.created_at;
            return (
              <article key={item.id} className="announcement-card" data-id={item.id}>
                {editingId === item.id ? (
                  <form className="announcement-edit-form" onSubmit={(event) => handleSave(event, item.id)}>
                    <label>
                      Title
                      <input name="title" defaultValue={item.title} maxLength={200} required />
                    </label>
                    <label>
                      Announcement
                      <textarea name="body" defaultValue={item.body} maxLength={10000} required />
                    </label>
                    <div className="form-actions">
                      <button type="submit" className="btn btn-primary" disabled={action.busy}>Save</button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setEditingId(null);
                          focusIn(item.id, '.more-options-btn');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <h3>{item.title}</h3>
                    <p className="announcement-text">{item.body}</p>
                    <small className="announcement-meta">
                      {item.author?.full_name ? `${item.author.full_name} · ` : ''}
                      {formatDateTime(edited ? item.updated_at : item.created_at)}
                      {edited && <span className="italic"> (Edited)</span>}
                    </small>

                    {canManage && (
                      <>
                        <button
                          type="button"
                          className="more-options-btn"
                          aria-label={`More options for ${item.title}`}
                          aria-haspopup="true"
                          aria-expanded={openMenuId === item.id}
                          onClick={() => toggleMenu(item.id)}
                        >
                          ⋮
                        </button>
                        <div
                          className="announcement-options"
                          role="menu"
                          hidden={openMenuId !== item.id}
                          onKeyDown={(event) => handleMenuKeys(event, item.id)}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setEditingId(item.id);
                              setOpenMenuId(null);
                              focusIn(item.id, 'input[name="title"]');
                            }}
                          >
                            Edit announcement
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="delete-option"
                            onClick={() => handleDelete(item.id, item.title)}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
