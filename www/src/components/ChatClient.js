"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Image as ImageIcon,
  Paperclip,
  PenLine,
  Plus,
  Save,
  SendHorizontal,
  Square,
  Users,
  Video,
  X,
} from "lucide-react";
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
  const isDevelopment = process.env.NODE_ENV === "development";

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
      <aside className="cyber-chat-sidebar flex h-full min-h-0 w-72 shrink-0 flex-col">
        <div className="cyber-chat-sidebar-header shrink-0 p-3">
          <button type="button" className="cyber-btn cyber-btn-solid w-full" onClick={createSession}>
            <Plus size={16} />
            New chat
          </button>
        </div>

        <div className="cyber-scroll min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="cyber-kicker">Sessions</p>
            <span className="cyber-muted text-[11px]">
              <Users size={11} className="mr-1 inline" />
              {sessions.length}
            </span>
          </div>

          <p className="mb-2 px-1">
            <Link className="cyber-link text-xs" href="/leaderboards">
              View full leaderboards
            </Link>
          </p>

          <ul className="space-y-2">
            {sessions.map((session) => {
              const active = session.id === activeSessionId;
              const isEditing = editingSessionId === session.id;

              return (
                <li key={session.id}>
                  {isEditing ? (
                    <form className="cyber-note space-y-2" onSubmit={(event) => saveSessionTitle(event, session.id)}>
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
                          <Save size={12} />
                          {savingTitle ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          className="cyber-btn cyber-btn-outline !min-h-0 !px-2 !py-1 !text-[10px]"
                          onClick={cancelEditingSession}
                          disabled={savingTitle}
                        >
                          <X size={12} />
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      className={`flex items-start gap-2 px-2 py-2 ${active ? "cyber-session-item cyber-session-item-active" : "cyber-session-item"}`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => loadSessionMessages(session.id)}
                      >
                        <span className="block truncate text-sm font-medium">
                          {session.title || "New session"}
                        </span>
                        <span className={`block text-xs ${active ? "cyber-session-status-active" : "cyber-session-status"}`}>
                          {session.is_ended ? "Ended" : "Active"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`cyber-session-edit p-1 text-xs ${active ? "cyber-session-status-active" : "cyber-session-status"}`}
                        onClick={() => startEditingSession(session)}
                        aria-label="Edit session name"
                        title="Edit session name"
                      >
                        <PenLine size={12} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <section className="cyber-chat-main flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="cyber-chat-main-header shrink-0 px-4 py-3">
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
              <Square size={16} />
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
                  <Plus size={16} />
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
                  const aiDebug = message.ai_debug || null;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed ${isUser ? "cyber-note cyber-message-user" : "cyber-note cyber-message-assistant"}`}>
                        {messageAttachments.length > 0 ? (
                          <div className="mb-2 grid gap-2">
                            {messageAttachments.map((attachment) => (
                              <div key={attachment.id} className="cyber-attachment-card">
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
                                  <video src={attachment.url} controls preload="metadata" className="max-h-72 w-full object-contain" />
                                )}
                                <div className="cyber-attachment-meta flex items-center justify-between gap-2 px-2 py-1 text-[11px]">
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

                        {message.content ? (
                          <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                            {message.content}
                          </div>
                        ) : null}
                        {isDevelopment && !isUser ? (
                          <details className="mt-2 border-t border-[rgba(21,40,82,0.12)] pt-2 text-[11px] cyber-muted">
                            <summary className="cursor-pointer font-semibold text-foreground">
                              Debug details
                            </summary>
                            <div className="mt-2 space-y-2">
                              <p>
                                {Number.isFinite(message.ai_score)
                                  ? `Dev score: ${message.ai_score}/10`
                                  : "Dev score: not returned by AI"}
                                {message.ai_score_source
                                  ? ` (${message.ai_score_source})`
                                  : ""}
                              </p>
                              <p>
                                Rating line:{" "}
                                <code>{aiDebug?.rating_line || "[[SCORE:N]]"}</code>
                              </p>
                              <p>
                                Explicit rating returned:{" "}
                                {aiDebug?.had_explicit_rating ? "yes" : "no"}
                              </p>
                              <p>
                                Fallback applied:{" "}
                                {aiDebug?.score_fallback_applied ? "yes" : "no"}
                              </p>
                              <p>
                                Input modality hint:{" "}
                                {aiDebug?.input_modality_hint || "none"}
                              </p>
                              <p>
                                Relevant by keyword:{" "}
                                {aiDebug?.relevant_by_keyword ? "yes" : "no"}
                              </p>
                              <p>
                                Submission hash:{" "}
                                <code>{aiDebug?.submission_hash || "n/a"}</code>
                              </p>

                              <div>
                                <p className="font-semibold text-foreground">Raw model output (unstripped)</p>
                                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md border border-[rgba(21,40,82,0.16)] bg-[rgba(255,255,255,0.38)] p-2 text-[10px] leading-relaxed text-foreground">
                                  {aiDebug?.raw_output || "(empty)"}
                                </pre>
                              </div>

                              <div>
                                <p className="font-semibold text-foreground">Canonical output (forced score at end)</p>
                                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md border border-[rgba(21,40,82,0.16)] bg-[rgba(255,255,255,0.38)] p-2 text-[10px] leading-relaxed text-foreground">
                                  {aiDebug?.canonical_output || "(empty)"}
                                </pre>
                              </div>
                            </div>
                          </details>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {sending ? (
                  <div className="flex justify-start">
                    <div className="cyber-note cyber-message-assistant">
                      <div className="flex items-center gap-1">
                        <span className="cyber-typing-dot" />
                        <span
                          className="cyber-typing-dot"
                          style={{ animationDelay: "120ms" }}
                        />
                        <span
                          className="cyber-typing-dot"
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

        <form className="cyber-chat-composer shrink-0" onSubmit={handleSend}>
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-3">
            {pendingAttachments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {pendingAttachments.map((attachment) => (
                  <div key={attachment.id} className="cyber-note flex items-center gap-2 px-2 py-1.5 text-xs">
                    {attachment.kind === "video" ? (
                      <Video size={14} className="cyber-icon-video" />
                    ) : (
                      <ImageIcon size={14} className="cyber-icon-image" />
                    )}
                    <span className="max-w-[170px] truncate text-foreground">
                      {attachment.original_filename || "Attachment"}
                    </span>
                    <span className="cyber-muted text-[11px]">
                      {formatBytes(attachment.byte_size)}
                    </span>
                    <button
                      type="button"
                      className="cyber-remove-btn p-0.5"
                      onClick={() => removePendingAttachment(attachment.id)}
                      aria-label="Remove attachment"
                      title="Remove attachment"
                      disabled={sending}
                    >
                      <X size={12} />
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
                  <span className="cyber-upload-spinner" />
                ) : (
                  <Paperclip size={15} />
                )}
              </button>

              <div className="cyber-input-wrap flex-1">
                <textarea
                  ref={composerTextareaRef}
                  className="cyber-textarea cyber-scroll max-h-32 min-h-[44px] resize-none overflow-y-auto py-2.5 leading-6"
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
                <SendHorizontal size={16} />
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
