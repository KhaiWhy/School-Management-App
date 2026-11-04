import { supabase, unwrap } from '../lib/supabase';
import type { Message } from './types';

// Your latest messages, newest first (Row Level Security returns only your own chats).
export async function listRecentMessages(): Promise<Message[]> {
  return unwrap(
    await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(300),
  );
}

// The newest 500 messages of a conversation, oldest first on screen.
export async function listThread(me: string, other: string): Promise<Message[]> {
  const rows: Message[] = unwrap(
    await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`)
      .order('created_at', { ascending: false })
      .limit(500),
  );
  return rows.reverse();
}

export async function sendMessage(recipientId: string, body: string): Promise<Message> {
  return unwrap(
    await supabase.from('messages').insert({ recipient_id: recipientId, body: body.trim() }).select().single(),
  );
}

// Calls onMessage for every new message you can see. Returns a function that stops listening.
export function subscribeToMessages(onMessage: (message: Message) => void) {
  const channel = supabase
    .channel(`messages-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) =>
      onMessage(payload.new as Message),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
