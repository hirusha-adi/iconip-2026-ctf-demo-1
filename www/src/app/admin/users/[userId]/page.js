import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';

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

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="cyber-title text-xl font-bold text-foreground">User: {detail.profile.email}</h2>
          <p className="cyber-muted text-xs">Clerk ID: {detail.profile.clerk_user_id}</p>
        </div>
        <Link className="cyber-btn cyber-btn-outline" href="/admin/users/all">
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
              Save email
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            <form action={toggleVerifiedAction}>
              <input type="hidden" name="nextValue" value={String(!detail.profile.is_verified)} />
              <button className="cyber-btn cyber-btn-outline" type="submit">
                {detail.profile.is_verified ? 'De-verify account' : 'Verify account'}
              </button>
            </form>

            <form action={toggleAdminAction}>
              <input type="hidden" name="nextValue" value={String(!detail.profile.is_admin)} />
              <button className="cyber-btn cyber-btn-secondary" type="submit">
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
            <li>Invalid route attempts: {invalidRouteAttempts}</li>
          </ul>
        </Card>
      </div>

      <Card title="Chat history">
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
                  {sessionMessages.map((message) => (
                    <p key={message.id} className="text-sm text-foreground">
                      <span className="font-medium">{message.role}:</span> {message.content}
                    </p>
                  ))}
                  {!sessionMessages.length ? <p className="cyber-muted text-sm">No messages in this session.</p> : null}
                </div>
              </article>
            );
          })}
          {!detail.sessions.length ? <p className="cyber-muted text-sm">No chat sessions yet.</p> : null}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Auth events">
          <EventList items={detail.authEvents} emptyText="No auth events recorded." />
        </Card>
        <Card title="Route access logs">
          <EventList items={detail.routeLogs} emptyText="No route logs recorded." />
        </Card>
      </div>

      <Card title="Admin change log">
        <EventList items={detail.adminLogs} emptyText="No admin changes recorded." />
      </Card>
    </section>
  );
}

function Card({ title, children }) {
  return (
    <article className="cyber-card p-4">
      <h3 className="cyber-title mb-3 text-sm font-semibold text-[#00d4ff]">{title}</h3>
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
          <p className="font-semibold text-[#00d4ff]">{item.event_type || item.action || item.status || 'event'}</p>
          <p>{item.path || item.email || '-'}</p>
          <p>{new Date(item.created_at).toLocaleString()}</p>
        </li>
      ))}
    </ul>
  );
}
