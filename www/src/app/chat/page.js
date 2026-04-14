import Link from 'next/link';

import ChatClient from '@/components/ChatClient';
import { createChatSession, getChatMessages, getUserChatSessions } from '@/lib/server/db';
import { requirePageUser } from '@/lib/server/authz';

export default async function ChatPage({ searchParams }) {
  const { userId, profile } = await requirePageUser();
  const query = await searchParams;
  const requestedSessionId = typeof query.session === 'string' ? query.session : '';

  let sessions = await getUserChatSessions(userId);
  let initialSessionId = null;
  let initialMessages = [];
  let invalidRequestedSession = false;

  if (!requestedSessionId && !sessions.length) {
    const newSession = await createChatSession(userId);
    sessions = [newSession];
  }

  if (requestedSessionId) {
    const requestedSessionExists = sessions.some((session) => session.id === requestedSessionId);
    if (requestedSessionExists) {
      initialSessionId = requestedSessionId;
      initialMessages = await getChatMessages(initialSessionId, userId);
    } else {
      invalidRequestedSession = true;
    }
  } else if (sessions.length) {
    initialSessionId = sessions[0].id;
    initialMessages = await getChatMessages(initialSessionId, userId);
  }

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-6xl flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-4">
      <header className="mb-4 flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Welcome, {profile.first_name}</h1>
          <p className="text-xs text-zinc-500">Chat sessions are stored in Supabase.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100" href="/user">
            User
          </Link>
          {profile.is_admin ? (
            <Link className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100" href="/admin/users/all">
              Admin
            </Link>
          ) : null}
          <Link className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100" href="/logout">
            Logout
          </Link>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ChatClient
          initialSessions={sessions}
          initialSessionId={initialSessionId}
          initialMessages={initialMessages}
          hasInvalidRequestedSession={invalidRequestedSession}
        />
      </div>
    </main>
  );
}
