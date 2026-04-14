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
          <h2 className="text-xl font-semibold text-zinc-900">User: {detail.profile.email}</h2>
          <p className="text-sm text-zinc-500">Clerk ID: {detail.profile.clerk_user_id}</p>
        </div>
        <Link className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100" href="/admin/users/all">
          Back
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Profile controls">
          <form action={updateNameAction} className="space-y-2">
            <label className="block text-xs text-zinc-600" htmlFor="firstName">
              First name
              <input
                id="firstName"
                name="firstName"
                defaultValue={detail.profile.first_name}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block text-xs text-zinc-600" htmlFor="lastName">
              Last name
              <input
                id="lastName"
                name="lastName"
                defaultValue={detail.profile.last_name}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <button className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white" type="submit">
              Save name
            </button>
          </form>

          <form action={updateEmailAction} className="mt-4 space-y-2">
            <label className="block text-xs text-zinc-600" htmlFor="email">
              Email
              <input
                id="email"
                name="email"
                defaultValue={detail.profile.email}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <button className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white" type="submit">
              Save email
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            <form action={toggleVerifiedAction}>
              <input type="hidden" name="nextValue" value={String(!detail.profile.is_verified)} />
              <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100" type="submit">
                {detail.profile.is_verified ? 'De-verify account' : 'Verify account'}
              </button>
            </form>

            <form action={toggleAdminAction}>
              <input type="hidden" name="nextValue" value={String(!detail.profile.is_admin)} />
              <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100" type="submit">
                {detail.profile.is_admin ? 'Remove admin' : 'Make admin'}
              </button>
            </form>
          </div>

          <form action={toggleDisabledAction} className="mt-4 space-y-2">
            <input type="hidden" name="nextValue" value={String(!detail.profile.is_disabled)} />
            <label className="block text-xs text-zinc-600" htmlFor="disabledReason">
              Disable reason
              <input
                id="disabledReason"
                name="disabledReason"
                defaultValue={detail.profile.disabled_reason || ''}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Optional reason"
              />
            </label>
            <button className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50" type="submit">
              {detail.profile.is_disabled ? 'Enable account' : 'Disable account'}
            </button>
          </form>
        </Card>

        <Card title="Activity summary">
          <ul className="space-y-1 text-sm text-zinc-700">
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
              <article key={session.id} className="rounded-md border border-zinc-200 p-3">
                <p className="text-sm font-semibold text-zinc-800">{session.title}</p>
                <p className="text-xs text-zinc-500">
                  Created: {new Date(session.created_at).toLocaleString()} {session.is_ended ? '• Ended' : ''}
                </p>
                <div className="mt-2 space-y-1">
                  {sessionMessages.map((message) => (
                    <p key={message.id} className="text-sm text-zinc-700">
                      <span className="font-medium">{message.role}:</span> {message.content}
                    </p>
                  ))}
                  {!sessionMessages.length ? <p className="text-sm text-zinc-500">No messages in this session.</p> : null}
                </div>
              </article>
            );
          })}
          {!detail.sessions.length ? <p className="text-sm text-zinc-500">No chat sessions yet.</p> : null}
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
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-zinc-900">{title}</h3>
      {children}
    </article>
  );
}

function EventList({ items, emptyText }) {
  if (!items.length) {
    return <p className="text-sm text-zinc-500">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-md border border-zinc-200 p-2 text-xs text-zinc-700">
          <p className="font-semibold text-zinc-800">{item.event_type || item.action || item.status || 'event'}</p>
          <p>{item.path || item.email || '-'}</p>
          <p>{new Date(item.created_at).toLocaleString()}</p>
        </li>
      ))}
    </ul>
  );
}
