import Link from 'next/link';
import {
  CheckCircle2,
  Eye,
  LogIn,
  MessageSquare,
  Paperclip,
  Shield,
  ShieldOff,
  UserRound,
} from 'lucide-react';

import { getAdminUsers } from '@/lib/server/db';

export default async function AdminUsersAllPage() {
  const { users, stats } = await getAdminUsers();

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        <StatCard label="Total users" value={stats.totalUsers} icon={<UserRound size={14} />} />
        <StatCard label="Online now" value={stats.onlineUsers} icon={<LogIn size={14} />} />
        <StatCard label="Verified users" value={stats.verifiedUsers} icon={<CheckCircle2 size={14} />} />
        <StatCard label="Admin users" value={stats.adminUsers} icon={<Shield size={14} />} />
        <StatCard label="Disabled users" value={stats.disabledUsers} icon={<ShieldOff size={14} />} />
        <StatCard label="Chat sessions" value={stats.totalChatSessions} icon={<MessageSquare size={14} />} />
        <StatCard label="Messages" value={stats.totalMessages} icon={<MessageSquare size={14} />} />
        <StatCard label="Attachments" value={stats.totalAttachments} icon={<Paperclip size={14} />} />
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
                    <Eye size={12} />
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

function StatCard({ label, value, icon }) {
  return (
    <article className="cyber-card h-full p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="cyber-kicker text-[10px] leading-none">{label}</p>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(21,40,82,0.2)] bg-[rgba(42,76,138,0.1)] text-[#1f3b70]">
          {icon}
        </span>
      </div>
      <p className="cyber-title mt-2 text-2xl font-bold leading-none text-foreground">
        {Number(value || 0).toLocaleString()}
      </p>
    </article>
  );
}

function Th({ children }) {
  return <th>{children}</th>;
}

function Td({ children }) {
  return <td>{children}</td>;
}
