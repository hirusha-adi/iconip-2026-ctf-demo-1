import Link from 'next/link';

import { requirePageAdmin } from '@/lib/server/authz';

export default async function AdminLayout({ children }) {
  const { profile } = await requirePageAdmin();

  return (
    <div className="flex flex-1">
      <div className="cyber-shell">
        <header className="cyber-card mb-4 flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="cyber-title text-lg font-bold text-foreground">Admin Panel</h1>
            <p className="cyber-muted text-xs">
              Welcome back {profile.first_name} ({profile.email})
            </p>
          </div>
          <div className="flex gap-2">
            <Link className="cyber-btn cyber-btn-user" href="/user">
              User
            </Link>
            <Link className="cyber-btn cyber-btn-chat" href="/chat">
              Chat
            </Link>
            <Link className="cyber-btn cyber-btn-admin-active" href="/admin/users/">
              Admin
            </Link>
            <Link className="cyber-btn cyber-btn-danger" href="/logout">
              Logout
            </Link>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
