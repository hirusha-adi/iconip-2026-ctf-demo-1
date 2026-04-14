import Link from 'next/link';

import ChatClient from '@/components/ChatClient';
import { createChatSession, getChatMessages, getUserChatSessions } from '@/lib/server/db';
import { requirePageUser } from '@/lib/server/authz';

export default async function ChatPage() {
  const { userId, profile } = await requirePageUser();

  let sessions = await getUserChatSessions(userId);

  if (!sessions.length) {
    const newSession = await createChatSession(userId);
    sessions = [newSession];
  }

  const initialSessionId = sessions[0].id;
  const initialMessages = await getChatMessages(initialSessionId, userId);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Welcome, {profile.first_name}</h1>
          <p className="text-xs text-zinc-500">Chat sessions are stored in Supabase.</p>
        </div>
        <div className="flex items-center gap-2">
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

      <ChatClient initialSessions={sessions} initialSessionId={initialSessionId} initialMessages={initialMessages} />
    </main>
  );
}
