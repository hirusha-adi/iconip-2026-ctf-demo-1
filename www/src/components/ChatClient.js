'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export default function ChatClient({
  initialSessions,
  initialSessionId,
  initialMessages,
  hasInvalidRequestedSession = false,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sessions, setSessions] = useState(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState(initialSessionId);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [invalidRequestedSession, setInvalidRequestedSession] = useState(hasInvalidRequestedSession);

  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const updateSessionInUrl = useCallback((sessionId) => {
    const url = new URL(window.location.href);

    if (sessionId) {
      url.searchParams.set('session', sessionId);
    } else {
      url.searchParams.delete('session');
    }

    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    if (invalidRequestedSession || !activeSessionId) {
      return;
    }

    const currentSessionInUrl = searchParams.get('session');
    if (currentSessionInUrl !== activeSessionId) {
      updateSessionInUrl(activeSessionId);
    }
  }, [activeSessionId, invalidRequestedSession, searchParams, updateSessionInUrl]);

  function startEditingSession(session) {
    setEditingSessionId(session.id);
    setEditingTitle(session.title || 'New session');
  }

  function cancelEditingSession() {
    setEditingSessionId(null);
    setEditingTitle('');
  }

  async function saveSessionTitle(event, sessionId) {
    event.preventDefault();

    const title = editingTitle.trim();
    if (!title) {
      toast.error('Session title cannot be empty');
      return;
    }

    if (title.length > 120) {
      toast.error('Session title must be 120 characters or less');
      return;
    }

    setSavingTitle(true);
    try {
      const payload = await parseResponse(
        await fetch(`/api/chat/sessions/${sessionId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title }),
        }),
      );

      const updatedSession = payload.session;
      setSessions((prev) => prev.map((session) => (session.id === updatedSession.id ? updatedSession : session)));
      cancelEditingSession();
      toast.success('Session title updated');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingTitle(false);
    }
  }

  async function loadSessionMessages(sessionId) {
    setLoadingMessages(true);
    try {
      const payload = await parseResponse(await fetch(`/api/chat/sessions/${sessionId}`));
      setMessages(payload.messages || []);
      setActiveSessionId(sessionId);
      setInvalidRequestedSession(false);
      updateSessionInUrl(sessionId);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function createSession() {
    try {
      const payload = await parseResponse(
        await fetch('/api/chat/sessions', {
          method: 'POST',
        }),
      );

      const newSession = payload.session;
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
      setInvalidRequestedSession(false);
      cancelEditingSession();
      updateSessionInUrl(newSession.id);
      toast.success('Started a new session');
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function endCurrentSession() {
    if (!activeSessionId) {
      return;
    }

    try {
      const payload = await parseResponse(
        await fetch(`/api/chat/sessions/${activeSessionId}`, {
          method: 'PATCH',
        }),
      );

      const updatedSession = payload.session;
      setSessions((prev) => prev.map((session) => (session.id === updatedSession.id ? updatedSession : session)));
      toast.success('Session ended');
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function handleSend(event) {
    event.preventDefault();

    const content = input.trim();
    if (!content || !activeSessionId || invalidRequestedSession) {
      return;
    }

    setSending(true);
    setInput('');

    const optimisticMessage = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const payload = await parseResponse(
        await fetch('/api/chat/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: activeSessionId,
            content,
          }),
        }),
      );

      const insertedMessages = payload.messages || [];
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((message) => message.id !== optimisticMessage.id);
        return [...withoutOptimistic, ...insertedMessages];
      });

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== activeSessionId) {
            return session;
          }

          if (!session.title || session.title === 'New session') {
            const title = content.length > 40 ? `${content.slice(0, 37)}...` : content;
            return {
              ...session,
              title,
              updated_at: new Date().toISOString(),
            };
          }

          return session;
        }),
      );
    } catch (error) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
      toast.error(error.message);
      setInput(content);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="flex min-h-0 flex-col rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <button
          type="button"
          className="w-full rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
          onClick={createSession}
        >
          New session
        </button>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          <ul className="space-y-2">
            {sessions.map((session) => {
              const active = session.id === activeSessionId;
              const isEditing = editingSessionId === session.id;

              return (
                <li key={session.id}>
                  {isEditing ? (
                    <form
                      className="rounded-md border border-zinc-200 bg-zinc-50 p-2"
                      onSubmit={(event) => saveSessionTitle(event, session.id)}
                    >
                      <input
                        type="text"
                        className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm outline-none ring-green-500 focus:ring"
                        value={editingTitle}
                        onChange={(event) => setEditingTitle(event.target.value)}
                        maxLength={120}
                        autoFocus
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="submit"
                          className="rounded-md bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                          disabled={savingTitle}
                        >
                          {savingTitle ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                          onClick={cancelEditingSession}
                          disabled={savingTitle}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      className={`flex items-start gap-2 rounded-md px-2 py-2 ${
                        active ? 'bg-green-100 text-green-900' : 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => loadSessionMessages(session.id)}>
                        <span className="block truncate text-sm font-medium">{session.title || 'New session'}</span>
                        <span className="block text-xs text-zinc-500">{session.is_ended ? 'Ended' : 'Active'}</span>
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-xs text-zinc-500 hover:bg-zinc-200"
                        onClick={() => startEditingSession(session)}
                        aria-label="Edit session name"
                        title="Edit session name"
                      >
                        ✎
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col rounded-xl border border-zinc-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Chat</h1>
            <p className="text-xs text-zinc-500">Assistant replies are stubbed as “Hello World”.</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            onClick={endCurrentSession}
            disabled={!activeSession || activeSession.is_ended}
          >
            End session
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {invalidRequestedSession ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-zinc-600">The session doesn&apos;t exist, please create a new one.</p>
              <button
                type="button"
                className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                onClick={createSession}
              >
                Create new session
              </button>
            </div>
          ) : (
            <>
              {loadingMessages ? <p className="text-sm text-zinc-500">Loading messages...</p> : null}
              {!messages.length && !loadingMessages ? (
                <p className="text-sm text-zinc-500">No messages yet. Start the conversation.</p>
              ) : null}

              <div className="space-y-3">
                {messages.map((message) => {
                  const isUser = message.role === 'user';
                  return (
                    <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                          isUser ? 'bg-green-600 text-white' : 'bg-green-100 text-green-900'
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <form className="border-t border-zinc-200 p-3" onSubmit={handleSend}>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
              placeholder="Type a message..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={!activeSessionId || invalidRequestedSession || (activeSession && activeSession.is_ended) || sending}
            />
            <button
              type="submit"
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!activeSessionId || invalidRequestedSession || !input.trim() || (activeSession && activeSession.is_ended) || sending}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
