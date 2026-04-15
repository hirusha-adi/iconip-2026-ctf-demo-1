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

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
  const fileInputRef = useRef(null);
  const MIN_COMPOSER_HEIGHT = 44;
  const MAX_COMPOSER_HEIGHT = 128;

  const [sessions, setSessions] = useState(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState(initialSessionId);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
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

  const sendDisabled =
    inputDisabled ||
    uploadingAttachments ||
    (!input.trim() && pendingAttachments.length === 0);

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
      setPendingAttachments([]);
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
      setMessages(payload.messages || []);
      setPendingAttachments([]);
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

  async function uploadAttachment(file) {
    if (!activeSessionId || invalidRequestedSession) {
      return;
    }

    const formData = new FormData();
    formData.set("sessionId", activeSessionId);
    formData.set("file", file);

    const payload = await parseResponse(
      await fetch("/api/chat/attachments", {
        method: "POST",
        body: formData,
      }),
    );

    setPendingAttachments((prev) => [...prev, payload.attachment]);
  }

  async function handleAttachmentSelection(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) {
      return;
    }

    if (!activeSessionId || invalidRequestedSession) {
      toast.error("Select a valid session before uploading attachments");
      return;
    }

    if (activeSession?.is_ended) {
      toast.error("Cannot upload attachments to an ended session");
      return;
    }

    setUploadingAttachments(true);
    let successCount = 0;

    try {
      for (const file of files) {
        try {
          await uploadAttachment(file);
          successCount += 1;
        } catch (error) {
          toast.error(`${file.name}: ${error.message}`);
        }
      }

      if (successCount > 0) {
        toast.success(
          `${successCount} attachment${successCount > 1 ? "s" : ""} ready`,
        );
      }
    } finally {
      setUploadingAttachments(false);
    }
  }

  async function removePendingAttachment(attachmentId) {
    try {
      await parseResponse(
        await fetch(`/api/chat/attachments/${attachmentId}`, {
          method: "DELETE",
        }),
      );

      setPendingAttachments((prev) =>
        prev.filter((attachment) => attachment.id !== attachmentId),
      );
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function handleSend(event) {
    event.preventDefault();

    const content = input.trim();
    const attachmentsForSend = pendingAttachments;

    if (
      (!content && attachmentsForSend.length === 0) ||
      !activeSessionId ||
      invalidRequestedSession ||
      uploadingAttachments
    ) {
      return;
    }

    setSending(true);
    setInput("");
    setPendingAttachments([]);

    const optimisticMessage = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content,
      attachments: attachmentsForSend,
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
            attachmentIds: attachmentsForSend.map((attachment) => attachment.id),
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
            const titleSource =
              content ||
              attachmentsForSend[0]?.original_filename ||
              "Attachment";
            const title =
              titleSource.length > 40
                ? `${titleSource.slice(0, 37)}...`
                : titleSource;
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
      setPendingAttachments(attachmentsForSend);
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
                  className="cyber-btn cyber-btn-admin !h-8 !min-h-0 !w-8 !p-0"
                  href="/admin/users/"
                  aria-label="Admin"
                  title="Admin"
                >
                  <AdminIcon />
                </Link>
              ) : null}
              <Link
                className="cyber-btn cyber-btn-user !h-8 !min-h-0 !w-8 !p-0"
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
                  const messageAttachments = Array.isArray(message.attachments)
                    ? message.attachments
                    : [];
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
                        {messageAttachments.length > 0 ? (
                          <div className="mb-2 grid gap-2">
                            {messageAttachments.map((attachment) => (
                              <div
                                key={attachment.id}
                                className="overflow-hidden rounded border border-[#2a2a3a] bg-[#0f1018]"
                              >
                                {attachment.kind === "image" ? (
                                  <a
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={attachment.url}
                                      alt={
                                        attachment.original_filename ||
                                        "attachment"
                                      }
                                      className="max-h-72 w-full object-cover"
                                      loading="lazy"
                                    />
                                  </a>
                                ) : (
                                  <video
                                    src={attachment.url}
                                    controls
                                    preload="metadata"
                                    className="max-h-72 w-full bg-black object-contain"
                                  />
                                )}
                                <div className="flex items-center justify-between gap-2 px-2 py-1 text-[11px] text-[#a3acc2]">
                                  <span className="truncate">
                                    {attachment.original_filename ||
                                      "Attachment"}
                                  </span>
                                  <span className="shrink-0">
                                    {formatBytes(attachment.byte_size)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {message.content ? <p>{message.content}</p> : null}
                      </div>
                    </div>
                  );
                })}

                {sending ? (
                  <div className="flex justify-start">
                    <div className="cyber-note border-[#2a2a3a] bg-[#151525] text-foreground">
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00d4ff]" />
                        <span
                          className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00d4ff]"
                          style={{ animationDelay: "120ms" }}
                        />
                        <span
                          className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00d4ff]"
                          style={{ animationDelay: "240ms" }}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div ref={messageEndRef} />
          </div>
        </div>

        <form
          className="shrink-0 border-t border-[#2a2a3a] bg-[#11111b]"
          onSubmit={handleSend}
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-3">
            {pendingAttachments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {pendingAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="cyber-note flex items-center gap-2 border-[#2a2a3a] bg-[#131422] px-2 py-1.5 text-xs"
                  >
                    {attachment.kind === "video" ? (
                      <VideoMiniIcon />
                    ) : (
                      <ImageMiniIcon />
                    )}
                    <span className="max-w-[170px] truncate text-[#d9dfef]">
                      {attachment.original_filename || "Attachment"}
                    </span>
                    <span className="text-[11px] text-[#8f99b3]">
                      {formatBytes(attachment.byte_size)}
                    </span>
                    <button
                      type="button"
                      className="rounded p-0.5 text-[#8f99b3] hover:bg-[rgba(255,51,102,0.16)] hover:text-[#ff8fab]"
                      onClick={() => removePendingAttachment(attachment.id)}
                      aria-label="Remove attachment"
                      title="Remove attachment"
                      disabled={sending}
                    >
                      <CloseMiniIcon />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/gif,image/webp,video/mp4"
                multiple
                onChange={handleAttachmentSelection}
                disabled={inputDisabled || uploadingAttachments}
              />

              <button
                type="button"
                className="cyber-btn cyber-btn-outline !h-[44px] !min-h-0 !w-[44px] !px-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={inputDisabled || uploadingAttachments}
                aria-label="Add attachment"
                title="Add attachment"
              >
                {uploadingAttachments ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#00d4ff] border-t-transparent" />
                ) : (
                  <PaperclipIcon />
                )}
              </button>

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
                disabled={sendDisabled}
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
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

function PaperclipIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21.44 11.05-8.49 8.49a5 5 0 0 1-7.07-7.07l9.9-9.9a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.2a2 2 0 1 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function ImageMiniIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-[#00d4ff]"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m21 15-4-4L5 21" />
    </svg>
  );
}

function VideoMiniIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-[#ff79c6]"
    >
      <rect x="2" y="6" width="15" height="12" rx="2" />
      <path d="m17 10 5-3v10l-5-3z" />
    </svg>
  );
}

function CloseMiniIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
