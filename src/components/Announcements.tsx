import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import * as store from '../data/store';
import type { Announcement } from '../data/types';

// Ported from legacy/home.html. Teachers post, edit and delete; students read.

// The title and text fields, reached by name on both forms.
interface AnnouncementFields extends HTMLFormControlsCollection {
  title: HTMLInputElement;
  text: HTMLTextAreaElement;
}

function fields(form: HTMLFormElement) {
  return form.elements as AnnouncementFields;
}

function formatWhen(item: Announcement) {
  if (!item.createdAt) return item.legacyDate || '';
  const stamp = item.editedAt && item.editedAt !== 'legacy' ? item.editedAt : item.createdAt;
  return new Date(stamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function Announcements({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    store.listAnnouncements().then(setItems);
  }, []);

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
    const text = fields(form).text.value.trim();
    if (!title || !text) return;
    setItems(await store.createAnnouncement({ title, text }));
    setOpenMenuId(null);
    setEditingId(null);
    form.reset();
  }

  async function handleSave(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const { title: titleInput, text: textInput } = fields(event.currentTarget);
    const title = titleInput.value.trim();
    const text = textInput.value.trim();
    if (!title) {
      titleInput.value = '';
      titleInput.reportValidity();
      return;
    }
    if (!text) {
      textInput.value = '';
      textInput.reportValidity();
      return;
    }
    setItems(await store.updateAnnouncement(id, { title, text }));
    setEditingId(null);
    focusIn(id, '.more-options-btn');
  }

  async function handleDelete(id: string) {
    setItems(await store.deleteAnnouncement(id));
    setOpenMenuId(null);
    setEditingId(null);
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

  return (
    <section className="announcements" aria-labelledby="announcements-title">
      <h1 id="announcements-title" className="page-title">Announcements</h1>

      {canManage && (
        <form className="announcement-form" onSubmit={handleCreate}>
          <label className="visually-hidden" htmlFor="new-title">Title</label>
          <input id="new-title" name="title" placeholder="Write your title here..." required />
          <label className="visually-hidden" htmlFor="new-text">Announcement</label>
          <textarea id="new-text" name="text" placeholder="Write your announcement here..." required />
          <button type="submit" className="btn btn-primary">Add announcement</button>
        </form>
      )}

      {items.length === 0 ? (
        <p className="empty">No announcements yet.</p>
      ) : (
        <div ref={listRef}>
          {items.map((item) => (
            <article key={item.id} className="announcement-card" data-id={item.id}>
              {editingId === item.id ? (
                <form className="announcement-edit-form" onSubmit={(event) => handleSave(event, item.id)}>
                  <label>
                    Title
                    <input name="title" defaultValue={item.title} required />
                  </label>
                  <label>
                    Announcement
                    <textarea name="text" defaultValue={item.text} required />
                  </label>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">Save</button>
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
                  <h2>{item.title}</h2>
                  <p className="announcement-text">{item.text}</p>
                  <small className="announcement-meta">
                    {formatWhen(item)}
                    {item.editedAt && <span className="italic"> (Edited)</span>}
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
                          onClick={() => handleDelete(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
