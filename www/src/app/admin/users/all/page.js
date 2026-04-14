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

      <div className="cyber-table-wrap cyber-scroll">
        <table className="cyber-table">
          <thead>
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
          <tbody>
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
                    className="cyber-btn cyber-btn-outline !min-h-0 !px-2 !py-1 !text-[10px]"
                    href={`/admin/users/${user.clerk_user_id}`}
                  >
                    View
                  </Link>
                </Td>
              </tr>
            ))}
            {!users.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm cyber-muted">
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
    <article className="cyber-card p-3">
      <p className="cyber-kicker text-[10px]">{label}</p>
      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
    </article>
  );
}

function Th({ children }) {
  return <th>{children}</th>;
}

function Td({ children }) {
  return <td>{children}</td>;
}
