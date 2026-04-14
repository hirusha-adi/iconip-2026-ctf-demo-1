import Link from 'next/link';

import { getAdminUsers } from '@/lib/server/db';

export default async function AdminUsersAllPage() {
  const { users, stats } = await getAdminUsers();

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total users" value={stats.totalUsers} />
        <StatCard label="Online now" value={stats.onlineUsers} />
        <StatCard label="Verified" value={stats.verifiedUsers} />
        <StatCard label="Admins" value={stats.adminUsers} />
        <StatCard label="Disabled" value={stats.disabledUsers} />
        <StatCard label="Chat sessions" value={stats.totalChatSessions} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <Th>Email</Th>
              <Th>Name</Th>
              <Th>Verified</Th>
              <Th>Admin</Th>
              <Th>Disabled</Th>
              <Th>Last seen</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.map((user) => (
              <tr key={user.clerk_user_id}>
                <Td>{user.email}</Td>
                <Td>{`${user.first_name} ${user.last_name}`}</Td>
                <Td>{user.is_verified ? 'Yes' : 'No'}</Td>
                <Td>{user.is_admin ? 'Yes' : 'No'}</Td>
                <Td>{user.is_disabled ? 'Yes' : 'No'}</Td>
                <Td>{user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : 'Never'}</Td>
                <Td>
                  <Link
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    href={`/admin/users/${user.clerk_user_id}`}
                  >
                    View
                  </Link>
                </Td>
              </tr>
            ))}
            {!users.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                  No users found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatCard({ label, value }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-900">{value}</p>
    </article>
  );
}

function Th({ children }) {
  return <th className="px-4 py-3 text-left font-semibold text-zinc-700">{children}</th>;
}

function Td({ children }) {
  return <td className="px-4 py-3 text-zinc-700">{children}</td>;
}
