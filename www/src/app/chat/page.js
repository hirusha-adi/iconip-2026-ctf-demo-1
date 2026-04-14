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
    <main className="h-[100dvh] w-full overflow-hidden bg-zinc-100">
      <div className="h-full min-h-0 p-2 sm:p-3">
        <ChatClient
          initialSessions={sessions}
          initialSessionId={initialSessionId}
          initialMessages={initialMessages}
          hasInvalidRequestedSession={invalidRequestedSession}
          userName={profile.first_name}
          isAdmin={profile.is_admin}
        />
      </div>
    </main>
  );
}
