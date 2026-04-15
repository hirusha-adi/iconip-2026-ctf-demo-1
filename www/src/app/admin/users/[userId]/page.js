import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Mail,
  Save,
  Shield,
  ShieldOff,
  UserRoundMinus,
  UserRoundPlus,
  XCircle,
} from 'lucide-react';

import { requirePageAdmin } from '@/lib/server/authz';
import { getAdminUserDetail, updateUserByAdmin } from '@/lib/server/db';
import { safeSetDisabledState, safeUpdateClerkUser } from '@/lib/server/clerk';

export default async function AdminUserDetailPage({ params }) {
  const { userId: targetUserId } = await params;
  await requirePageAdmin();

  const detail = await getAdminUserDetail(targetUserId);

  if (!detail.profile) {
    notFound();
  }

  async function updateNameAction(formData) {
    'use server';

    const { userId: actorUserId } = await requirePageAdmin();

    const firstName = String(formData.get('firstName') || '').trim();
    const lastName = String(formData.get('lastName') || '').trim();

    if (!firstName || !lastName) {
      return;
    }

    const updated = await updateUserByAdmin({
      actorUserId,
      targetUserId,
      updates: { firstName, lastName },
    });

    if (updated) {
      await safeUpdateClerkUser(targetUserId, { firstName, lastName });
    }

    revalidatePath(`/admin/users/${targetUserId}`);
    revalidatePath('/admin/users/all');
  }

  async function updateEmailAction(formData) {
    'use server';

    const { userId: actorUserId } = await requirePageAdmin();
    const email = String(formData.get('email') || '').trim().toLowerCase();

    if (!email) {
      return;
    }

    await updateUserByAdmin({
      actorUserId,
      targetUserId,
      updates: { email },
    });

    revalidatePath(`/admin/users/${targetUserId}`);
    revalidatePath('/admin/users/all');
  }

  async function toggleVerifiedAction(formData) {
    'use server';

    const { userId: actorUserId } = await requirePageAdmin();
    const nextValue = formData.get('nextValue') === 'true';

    await updateUserByAdmin({
      actorUserId,
      targetUserId,
      updates: { isVerified: nextValue },
    });

    revalidatePath(`/admin/users/${targetUserId}`);
    revalidatePath('/admin/users/all');
  }

  async function toggleAdminAction(formData) {
    'use server';

    const { userId: actorUserId } = await requirePageAdmin();
    const nextValue = formData.get('nextValue') === 'true';

    await updateUserByAdmin({
      actorUserId,
      targetUserId,
      updates: { isAdmin: nextValue },
    });

    revalidatePath(`/admin/users/${targetUserId}`);
    revalidatePath('/admin/users/all');
  }

  async function toggleDisabledAction(formData) {
    'use server';

    const { userId: actorUserId } = await requirePageAdmin();
    const nextValue = formData.get('nextValue') === 'true';
    const disabledReason = String(formData.get('disabledReason') || '').trim();

    await updateUserByAdmin({
      actorUserId,
      targetUserId,
      updates: {
        isDisabled: nextValue,
        disabledReason,
      },
    });

    await safeSetDisabledState(targetUserId, nextValue);

    revalidatePath(`/admin/users/${targetUserId}`);
    revalidatePath('/admin/users/all');
  }

  const invalidRouteAttempts = detail.routeLogs.filter((entry) => entry.status === 'invalid_route').length;
  const attachmentsByMessageId = new Map();
  const sessionsById = new Map(detail.sessions.map((session) => [session.id, session]));
  const messagesById = new Map(detail.messages.map((message) => [message.id, message]));

  for (const attachment of detail.attachments) {
    if (!attachment.message_id) {
      continue;
    }

    if (!attachmentsByMessageId.has(attachment.message_id)) {
      attachmentsByMessageId.set(attachment.message_id, []);
    }

    attachmentsByMessageId.get(attachment.message_id).push(attachment);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="cyber-title text-xl font-bold text-foreground">User: {detail.profile.email}</h2>
          <p className="cyber-muted text-xs">Clerk ID: {detail.profile.clerk_user_id}</p>
        </div>
        <Link className="cyber-btn cyber-btn-outline" href="/admin/users/all">
          <ArrowLeft size={16} />
          Back
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Profile controls">
          <form action={updateNameAction} className="space-y-3">
            <label className="cyber-label" htmlFor="firstName">
              First name
              <div className="cyber-input-wrap">
                <input
                  id="firstName"
                  name="firstName"
                  defaultValue={detail.profile.first_name}
                  className="cyber-input"
                  required
                />
              </div>
            </label>
            <label className="cyber-label" htmlFor="lastName">
              Last name
              <div className="cyber-input-wrap">
                <input
                  id="lastName"
                  name="lastName"
                  defaultValue={detail.profile.last_name}
                  className="cyber-input"
                  required
                />
              </div>
            </label>
            <button className="cyber-btn cyber-btn-solid" type="submit">
              <Save size={16} />
              Save name
            </button>
          </form>

          <form action={updateEmailAction} className="mt-4 space-y-3">
            <label className="cyber-label" htmlFor="email">
              Email
              <div className="cyber-input-wrap">
                <input
                  id="email"
                  name="email"
                  defaultValue={detail.profile.email}
                  className="cyber-input"
                  required
                />
              </div>
            </label>
            <button className="cyber-btn cyber-btn-solid" type="submit">
              <Mail size={16} />
              Save email
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            <form action={toggleVerifiedAction}>
              <input type="hidden" name="nextValue" value={String(!detail.profile.is_verified)} />
              <button className="cyber-btn cyber-btn-outline" type="submit">
                {detail.profile.is_verified ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                {detail.profile.is_verified ? 'De-verify account' : 'Verify account'}
              </button>
            </form>

            <form action={toggleAdminAction}>
              <input type="hidden" name="nextValue" value={String(!detail.profile.is_admin)} />
              <button className="cyber-btn cyber-btn-secondary" type="submit">
                {detail.profile.is_admin ? <UserRoundMinus size={16} /> : <UserRoundPlus size={16} />}
                {detail.profile.is_admin ? 'Remove admin' : 'Make admin'}
              </button>
            </form>
          </div>

          <form action={toggleDisabledAction} className="mt-4 space-y-3">
            <input type="hidden" name="nextValue" value={String(!detail.profile.is_disabled)} />
            <label className="cyber-label" htmlFor="disabledReason">
              Disable reason
              <div className="cyber-input-wrap">
                <input
                  id="disabledReason"
                  name="disabledReason"
                  defaultValue={detail.profile.disabled_reason || ''}
                  className="cyber-input"
                  placeholder="Optional reason"
                />
              </div>
            </label>
            <button className="cyber-btn cyber-btn-danger" type="submit">
              {detail.profile.is_disabled ? <Shield size={16} /> : <ShieldOff size={16} />}
              {detail.profile.is_disabled ? 'Enable account' : 'Disable account'}
            </button>
          </form>
        </Card>

        <Card title="Activity summary">
          <ul className="space-y-2 text-sm text-foreground">
            <li>Verified: {detail.profile.is_verified ? 'Yes' : 'No'}</li>
            <li>Admin: {detail.profile.is_admin ? 'Yes' : 'No'}</li>
            <li>Disabled: {detail.profile.is_disabled ? 'Yes' : 'No'}</li>
            <li>Last login: {detail.profile.last_login_at ? new Date(detail.profile.last_login_at).toLocaleString() : 'Never'}</li>
            <li>Last seen: {detail.profile.last_seen_at ? new Date(detail.profile.last_seen_at).toLocaleString() : 'Never'}</li>
            <li>Total chat sessions: {detail.sessions.length}</li>
            <li>Total messages loaded: {detail.messages.length}</li>
            <li>Total attachments loaded: {detail.attachments.length}</li>
            <li>Invalid route attempts: {invalidRouteAttempts}</li>
          </ul>
        </Card>
      </div>

      <Card title="Chat history">
        <div className="cyber-scroll h-[28rem] overflow-y-auto pr-1">
          <div className="space-y-3">
            {detail.sessions.map((session) => {
              const sessionMessages = detail.messages
                .filter((message) => message.session_id === session.id)
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

              return (
                <article key={session.id} className="cyber-note cyber-note-info">
                  <p className="text-sm font-semibold text-foreground">{session.title}</p>
                  <p className="cyber-muted text-xs">
                    Created: {new Date(session.created_at).toLocaleString()} {session.is_ended ? '• Ended' : ''}
                  </p>
                  <div className="mt-2 space-y-1">
                    {sessionMessages.map((message) => {
                      const messageAttachments = attachmentsByMessageId.get(message.id) ?? [];

                      return (
                        <div key={message.id} className="cyber-note p-2">
                          <p className="text-sm text-foreground">
                            <span className="font-medium">{message.role}:</span>{' '}
                            {message.content ? message.content : <span className="cyber-muted">(no text)</span>}
                          </p>
                          {messageAttachments.length ? (
                            <div className="mt-2 space-y-1">
                              {messageAttachments.map((attachment) => (
                                <p key={attachment.id} className="text-xs">
                    <a
                      className="cyber-link"
                      href={attachment.storage_file_url}
                      target="_blank"
                      rel="noreferrer"
                      download={attachment.original_filename}
                    >
                      <Download size={12} className="mr-1 inline" />
                      Download {attachment.original_filename}
                    </a>
                                  <span className="cyber-muted"> · {formatAttachmentMeta(attachment)}</span>
                                </p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {!sessionMessages.length ? <p className="cyber-muted text-sm">No messages in this session.</p> : null}
                  </div>
                </article>
              );
            })}
            {!detail.sessions.length ? <p className="cyber-muted text-sm">No chat sessions yet.</p> : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Auth events">
          <div className="cyber-scroll h-[28rem] overflow-y-auto pr-1">
            <EventList items={detail.authEvents} emptyText="No auth events recorded." />
          </div>
        </Card>
        <Card title="Route access logs">
          <div className="cyber-scroll h-[28rem] overflow-y-auto pr-1">
            <EventList items={detail.routeLogs} emptyText="No route logs recorded." />
          </div>
        </Card>
      </div>

      <Card title="Admin change log">
        <div className="cyber-scroll h-[28rem] overflow-y-auto pr-1">
          <EventList items={detail.adminLogs} emptyText="No admin changes recorded." />
        </div>
      </Card>

      <Card title="User attachments">
        <div className="cyber-scroll h-[28rem] overflow-y-auto pr-1">
          {detail.attachments.length ? (
            <ul className="space-y-2">
              {detail.attachments.map((attachment) => {
                const linkedSession = sessionsById.get(attachment.session_id);
                const linkedMessage = attachment.message_id ? messagesById.get(attachment.message_id) : null;

                return (
                  <li key={attachment.id} className="cyber-note p-2 text-xs text-foreground">
                    <p className="cyber-accent-text font-semibold">{attachment.original_filename}</p>
                    <p>{formatAttachmentMeta(attachment)}</p>
                    <p className="cyber-muted">
                      Chat: {linkedSession ? linkedSession.title : `Unknown (${attachment.session_id})`}
                    </p>
                    <p className="cyber-muted">
                      Linked message:{' '}
                      {linkedMessage
                        ? `${linkedMessage.role} • ${new Date(linkedMessage.created_at).toLocaleString()}`
                        : 'Not linked to a message'}
                    </p>
                    <a
                      className="cyber-link"
                      href={attachment.storage_file_url}
                      target="_blank"
                      rel="noreferrer"
                      download={attachment.original_filename}
                    >
                      <Download size={12} className="mr-1 inline" />
                      Download attachment
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="cyber-muted text-sm">No attachments uploaded by this user.</p>
          )}
        </div>
      </Card>
    </section>
  );
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function formatAttachmentMeta(attachment) {
  const parts = [String(attachment.kind || 'file').toUpperCase(), formatBytes(attachment.byte_size)];

  if (attachment.kind === 'video' && attachment.duration_seconds !== null && attachment.duration_seconds !== undefined) {
    parts.push(`${Number(attachment.duration_seconds).toFixed(1)}s`);
  }

  return parts.join(' · ');
}

function Card({ title, children }) {
  return (
    <article className="cyber-card p-4">
      <h3 className="cyber-title cyber-accent-text mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </article>
  );
}

function EventList({ items, emptyText }) {
  if (!items.length) {
    return <p className="cyber-muted text-sm">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="cyber-note p-2 text-xs text-foreground">
          <p className="cyber-accent-text font-semibold">{item.event_type || item.action || item.status || 'event'}</p>
          <p>{item.path || item.email || '-'}</p>
          <p>{new Date(item.created_at).toLocaleString()}</p>
        </li>
      ))}
    </ul>
  );
}
