import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import Icon from '../components/Icon';
import { Empty, ErrorNote, Loading } from '../components/ui';
import { listRecentMessages, listThread, sendMessage, subscribeToMessages } from '../data/messages';
import { listPeople } from '../data/people';
import type { Message, Profile } from '../data/types';
import { formatDateTime } from '../lib/format';
import { useAction, useLoad } from '../lib/useLoad';

export default function Messages() {
  const { userId } = useParams();
  const user = useUser();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data: people = [] } = useLoad(() => listPeople(), []);
  const { data: recent = [], setData: setRecent } = useLoad(listRecentMessages, []);

  // Keep the conversation list fresh when anything new arrives.
  useEffect(
    () => subscribeToMessages((m) => setRecent((list = []) => (list.some((x) => x.id === m.id) ? list : [m, ...list]))),
    [setRecent],
  );

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  // People you've talked to, most recent first.
  const conversations = useMemo(() => {
    const seen = new Map<string, Message>();
    for (const m of recent) {
      const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
      if (!seen.has(other)) seen.set(other, m);
    }
    return [...seen.entries()];
  }, [recent, user.id]);

  const term = search.trim().toLowerCase();
  const matches = term
    ? people.filter(
        (p) => p.id !== user.id && (p.full_name.toLowerCase().includes(term) || p.username.includes(term)),
      )
    : [];

  const other = userId ? byId.get(userId) : undefined;

  return (
    <section className={userId ? 'chat has-thread' : 'chat'}>
      <div className="chat-list">
        <h1 className="page-title">Messages</h1>
        <label className="visually-hidden" htmlFor="people-search">Find someone</label>
        <input
          id="people-search"
          type="search"
          placeholder="Find someone by name or username"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ul className="chat-people">
          {(term ? matches.map((p) => [p.id, undefined] as const) : conversations).map(([id, last]) => {
            const person = byId.get(id);
            return (
              <li key={id}>
                <Link
                  to={`/messages/${id}`}
                  className={id === userId ? 'chat-person is-active' : 'chat-person'}
                  onClick={() => setSearch('')}
                >
                  <strong>{person?.full_name || person?.username || 'Unknown'}</strong>
                  <small>{last ? last.body : `@${person?.username ?? ''}`}</small>
                </Link>
              </li>
            );
          })}
        </ul>
        {!term && conversations.length === 0 && <Empty>No messages yet. Search for someone to start.</Empty>}
        {term && matches.length === 0 && <Empty>No one matches "{search}".</Empty>}
      </div>

      <div className="chat-thread">
        {userId ? (
          other ? (
            <Thread me={user} other={other} onBack={() => navigate('/messages')} />
          ) : people.length ? (
            <Empty>That person wasn't found.</Empty>
          ) : (
            <Loading />
          )
        ) : (
          <Empty>Pick a conversation.</Empty>
        )}
      </div>
    </section>
  );
}

function Thread({ me, other, onBack }: { me: Profile; other: Profile; onBack: () => void }) {
  const { data: messages = [], loading, error, setData } = useLoad(() => listThread(me.id, other.id), [me.id, other.id]);
  const action = useAction();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      subscribeToMessages((m) => {
        const inThread =
          (m.sender_id === other.id && m.recipient_id === me.id) || (m.sender_id === me.id && m.recipient_id === other.id);
        if (inThread) setData((list = []) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
      }),
    [me.id, other.id, setData],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    let sent: Message | undefined;
    if (await action.run(async () => (sent = await sendMessage(other.id, body)))) {
      setDraft('');
      setData((list = []) => (list.some((x) => x.id === sent!.id) ? list : [...list, sent!]));
    }
  }

  return (
    <>
      <div className="chat-head">
        <button type="button" className="btn btn-small chat-back" onClick={onBack}>Back</button>
        <div>
          <strong>{other.full_name || other.username}</strong>
          <small> @{other.username}</small>
        </div>
      </div>
      <div className="chat-messages" aria-live="polite">
        {loading && messages.length === 0 ? (
          <Loading />
        ) : messages.length === 0 ? (
          <Empty>Say hello.</Empty>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.sender_id === me.id ? 'bubble bubble-mine' : 'bubble'}>
              <p>{m.body}</p>
              <small>{formatDateTime(m.created_at)}</small>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <ErrorNote error={action.error ?? error} />
      <form className="chat-compose" onSubmit={handleSend}>
        <label className="visually-hidden" htmlFor="compose">Message</label>
        <textarea
          id="compose"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Write a message…"
          maxLength={4000}
          rows={1}
        />
        <button type="submit" className="btn btn-primary" disabled={action.busy || !draft.trim()} aria-label="Send">
          <Icon name="send" size={18} />
        </button>
      </form>
    </>
  );
}
