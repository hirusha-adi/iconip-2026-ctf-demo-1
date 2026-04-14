"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export default function ChatClient({
  initialSessions,
  initialSessionId,
  initialMessages,
  hasInvalidRequestedSession = false,
  userName = "User",
  isAdmin = false,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const messageEndRef = useRef(null);
  const composerTextareaRef = useRef(null);
  const MIN_COMPOSER_HEIGHT = 44;
  const MAX_COMPOSER_HEIGHT = 128;

  const [sessions, setSessions] = useState(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState(initialSessionId);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [invalidRequestedSession, setInvalidRequestedSession] = useState(
    hasInvalidRequestedSession,
  );

  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const inputDisabled =
    !activeSessionId ||
    invalidRequestedSession ||
    (activeSession && activeSession.is_ended) ||
    sending;

  const updateSessionInUrl = useCallback(
    (sessionId) => {
      const url = new URL(window.location.href);

      if (sessionId) {
        url.searchParams.set("session", sessionId);
      } else {
        url.searchParams.delete("session");
      }

      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    },
    [router],
  );

  const resizeComposer = useCallback(() => {
    if (!composerTextareaRef.current) {
      return;
    }

    composerTextareaRef.current.style.height = "auto";
    const nextHeight = Math.min(
      MAX_COMPOSER_HEIGHT,
      Math.max(MIN_COMPOSER_HEIGHT, composerTextareaRef.current.scrollHeight),
    );
    composerTextareaRef.current.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    if (invalidRequestedSession || !activeSessionId) {
      return;
    }

    const currentSessionInUrl = searchParams.get("session");
    if (currentSessionInUrl !== activeSessionId) {
      updateSessionInUrl(activeSessionId);
    }
  }, [
    activeSessionId,
    invalidRequestedSession,
    searchParams,
    updateSessionInUrl,
  ]);

  useEffect(() => {
    if (invalidRequestedSession) {
      return;
    }

    if (!messageEndRef.current) {
      return;
    }

    messageEndRef.current.scrollIntoView({ block: "end" });
  }, [messages, invalidRequestedSession, activeSessionId]);

  useEffect(() => {
    resizeComposer();
  }, [input, resizeComposer]);

  function startEditingSession(session) {
    setEditingSessionId(session.id);
    setEditingTitle(session.title || "New session");
  }

  function cancelEditingSession() {
    setEditingSessionId(null);
    setEditingTitle("");
  }

  async function saveSessionTitle(event, sessionId) {
    event.preventDefault();

    const title = editingTitle.trim();
    if (!title) {
      toast.error("Session title cannot be empty");
      return;
    }

    if (title.length > 120) {
      toast.error("Session title must be 120 characters or less");
      return;
    }

    setSavingTitle(true);
    try {
      const payload = await parseResponse(
        await fetch(`/api/chat/sessions/${sessionId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title }),
        }),
      );

      const updatedSession = payload.session;
      setSessions((prev) =>
        prev.map((session) =>
          session.id === updatedSession.id ? updatedSession : session,
        ),
      );
      cancelEditingSession();
      toast.success("Session title updated");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingTitle(false);
    }
  }

  async function loadSessionMessages(sessionId) {
    setLoadingMessages(true);
    try {
      const payload = await parseResponse(
        await fetch(`/api/chat/sessions/${sessionId}`),
      );
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
        await fetch("/api/chat/sessions", {
          method: "POST",
        }),
      );

      const newSession = payload.session;
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
      setInvalidRequestedSession(false);
      cancelEditingSession();
      updateSessionInUrl(newSession.id);
      toast.success("Started a new session");
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
          method: "PATCH",
        }),
      );

      const updatedSession = payload.session;
      setSessions((prev) =>
        prev.map((session) =>
          session.id === updatedSession.id ? updatedSession : session,
        ),
      );
      toast.success("Session ended");
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
    setInput("");

    const optimisticMessage = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const payload = await parseResponse(
        await fetch("/api/chat/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: activeSessionId,
            content,
          }),
        }),
      );

      const insertedMessages = payload.messages || [];
      setMessages((prev) => {
        const withoutOptimistic = prev.filter(
          (message) => message.id !== optimisticMessage.id,
        );
        return [...withoutOptimistic, ...insertedMessages];
      });

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== activeSessionId) {
            return session;
          }

          if (!session.title || session.title === "New session") {
            const title =
              content.length > 40 ? `${content.slice(0, 37)}...` : content;
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
      setMessages((prev) =>
        prev.filter((message) => message.id !== optimisticMessage.id),
      );
      toast.error(error.message);
      setInput(content);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="cyber-card flex h-full min-h-0 overflow-hidden">
      <aside className="flex h-full min-h-0 w-72 shrink-0 flex-col border-r border-[#2a2a3a] bg-[#101018]">
        <div className="shrink-0 border-b border-[#2a2a3a] p-3">
          <p className="cyber-kicker">ICONIP CTF</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="cyber-title truncate text-sm font-semibold text-foreground">
              {userName}
            </p>
            <div className="flex items-center gap-1">
              {isAdmin ? (
                <Link
                  className="cyber-btn cyber-btn-secondary !h-8 !min-h-0 !w-8 !p-0"
                  href="/admin/users/"
                  aria-label="Admin"
                  title="Admin"
                >
                  <AdminIcon />
                </Link>
              ) : null}
              <Link
                className="cyber-btn cyber-btn-outline !h-8 !min-h-0 !w-8 !border-[#00d4ff] !p-0 !text-[#00d4ff]"
                href="/user"
                aria-label="User settings"
                title="User settings"
              >
                <UserIcon />
              </Link>
              <Link
                className="cyber-btn cyber-btn-danger !h-8 !min-h-0 !w-8 !p-0"
                href="/logout"
                aria-label="Logout"
                title="Logout"
              >
                <LogoutIcon />
              </Link>
            </div>
          </div>

          <button
            type="button"
            className="cyber-btn cyber-btn-solid mt-3 w-full"
            onClick={createSession}
          >
            New chat
          </button>
        </div>

        <div className="cyber-scroll min-h-0 flex-1 overflow-y-auto p-3">
          <ul className="space-y-2">
            {sessions.map((session) => {
              const active = session.id === activeSessionId;
              const isEditing = editingSessionId === session.id;

              return (
                <li key={session.id}>
                  {isEditing ? (
                    <form
                      className="cyber-note space-y-2 bg-[#141425]"
                      onSubmit={(event) => saveSessionTitle(event, session.id)}
                    >
                      <div className="cyber-input-wrap">
                        <input
                          type="text"
                          className="cyber-input"
                          value={editingTitle}
                          onChange={(event) =>
                            setEditingTitle(event.target.value)
                          }
                          maxLength={120}
                          autoFocus
                        />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="submit"
                          className="cyber-btn cyber-btn-solid !min-h-0 !px-2 !py-1 !text-[10px]"
                          disabled={savingTitle}
                        >
                          {savingTitle ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          className="cyber-btn cyber-btn-outline !min-h-0 !px-2 !py-1 !text-[10px]"
                          onClick={cancelEditingSession}
                          disabled={savingTitle}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      className={`flex items-start gap-2 px-2 py-2 ${
                        active
                          ? "cyber-note border-[#00ff88] bg-[rgba(0,255,136,0.16)] text-foreground shadow-[var(--box-shadow-neon-sm)]"
                          : "cyber-note border-[#2a2a3a] bg-[#12121a] text-foreground hover:border-[#00d4ff]"
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => loadSessionMessages(session.id)}
                      >
                        <span className="block truncate text-sm font-medium">
                          {session.title || "New session"}
                        </span>
                        <span
                          className={`block text-xs ${
                            active ? "text-[#b5ffe1]" : "text-[#8f99b3]"
                          }`}
                        >
                          {session.is_ended ? "Ended" : "Active"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`rounded p-1 text-xs ${
                          active
                            ? "text-[#00ff88] hover:bg-[rgba(0,255,136,0.14)]"
                            : "text-[#00d4ff] hover:bg-[rgba(0,212,255,0.12)]"
                        }`}
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

      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#0d0d14]">
        <header className="shrink-0 border-b border-[#2a2a3a] px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="cyber-title truncate text-base font-semibold text-foreground">
                {activeSession?.title || "New chat"}
              </h1>
              <p className="cyber-muted text-xs">
                {activeSession?.is_ended ? "Session ended" : "Session active"}
              </p>
            </div>
            <button
              type="button"
              className="cyber-btn cyber-btn-danger"
              onClick={endCurrentSession}
              disabled={!activeSession || activeSession.is_ended}
            >
              End session
            </button>
          </div>
        </header>

        <div className="cyber-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6">
            {invalidRequestedSession ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <p className="cyber-note cyber-note-error">
                  The session doesn&apos;t exist, please create a new one.
                </p>
                <button
                  type="button"
                  className="cyber-btn cyber-btn-solid"
                  onClick={createSession}
                >
                  Create new session
                </button>
              </div>
            ) : null}

            {!invalidRequestedSession && loadingMessages ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="cyber-note cyber-note-info">
                  Loading messages...
                </p>
              </div>
            ) : null}

            {!invalidRequestedSession &&
            !loadingMessages &&
            !messages.length ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="cyber-note cyber-note-info">
                  No messages yet. Start the conversation.
                </p>
              </div>
            ) : null}

            {!invalidRequestedSession &&
            !loadingMessages &&
            messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((message) => {
                  const isUser = message.role === "user";
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed ${
                          isUser
                            ? "cyber-note border-[#4dffbe] bg-[rgba(0,255,136,0.32)] text-[#f4fff9] shadow-[var(--box-shadow-neon-sm)]"
                            : "cyber-note border-[#2a2a3a] bg-[#151525] text-foreground"
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div ref={messageEndRef} />
          </div>
        </div>

        <form
          className="shrink-0 border-t border-[#2a2a3a] bg-[#11111b]"
          onSubmit={handleSend}
        >
          <div className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 py-3">
            <div className="cyber-input-wrap flex-1">
              <textarea
                ref={composerTextareaRef}
                className="cyber-input cyber-scroll max-h-32 min-h-[44px] resize-none overflow-y-auto py-2.5 leading-6"
                placeholder="Message..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                disabled={inputDisabled}
                rows={1}
              />
            </div>
            <button
              type="submit"
              className="cyber-btn cyber-btn-solid"
              disabled={inputDisabled || !input.trim()}
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function UserIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21a7 7 0 0 0-14 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 5 6v6c0 5 3.5 8 7 9 3.5-1 7-4 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
