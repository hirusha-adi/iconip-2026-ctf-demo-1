import ChatClient from "@/components/ChatClient";
import AppHeader from "@/components/AppHeader";
import { createSessionGreeting } from "@/lib/server/ai";
import {
  addChatMessage,
  createChatSession,
  getChallengeLeaderboardSnapshot,
  getChatMessages,
  getUserChatSessions,
} from "@/lib/server/db";
import { requirePageUser } from "@/lib/server/authz";

export default async function ChatPage({ searchParams }) {
  const { userId, profile } = await requirePageUser();
  const query = await searchParams;
  const requestedSessionId =
    typeof query.session === "string" ? query.session : "";

  let sessions = await getUserChatSessions(userId);
  let initialSessionId = null;
  let initialMessages = [];
  let invalidRequestedSession = false;

  if (!requestedSessionId && !sessions.length) {
    const newSession = await createChatSession(userId);
    await addChatMessage({
      sessionId: newSession.id,
      clerkUserId: userId,
      role: "assistant",
      content: createSessionGreeting(profile.first_name),
    });
    sessions = [newSession];
  }

  if (requestedSessionId) {
    const requestedSessionExists = sessions.some(
      (session) => session.id === requestedSessionId,
    );
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

  const initialChallenge = await getChallengeLeaderboardSnapshot({
    viewerUserId: userId,
    limit: 20,
  });

  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-background">
      <div className="cyber-page-shell h-full min-h-0 flex flex-col">
        <AppHeader profile={profile} active="chat" title="Chat Workspace" />

        <div className="cyber-page-content min-h-0 flex-1 mt-5! mb-0!">
          <ChatClient
            initialSessions={sessions}
            initialSessionId={initialSessionId}
            initialMessages={initialMessages}
            hasInvalidRequestedSession={invalidRequestedSession}
            initialChallenge={initialChallenge}
            currentUserId={userId}
          />
        </div>
      </div>
    </main>
  );
}
