import Link from 'next/link';
import { LogOut, MessageSquare, Shield, Trophy, User } from 'lucide-react';

function buttonClass(active, key, baseClass, activeClass) {
  return active === key ? `cyber-btn ${activeClass}` : `cyber-btn ${baseClass}`;
}

export default function AppHeader({ profile, active = '', title = 'Workspace' }) {
  const firstName = profile?.first_name || 'User';
  const email = profile?.email || '';
  const showAdmin = Boolean(profile?.is_admin);

  return (
    <header className="cyber-page-header">
      <div>
        <p className="cyber-kicker">{title}</p>
        <p className="cyber-page-title">Welcome back {firstName}{email ? ` (${email})` : ''}</p>
      </div>

      <nav className="cyber-page-actions" aria-label="Account navigation">
        <Link className={buttonClass(active, 'chat', 'cyber-btn-chat', 'cyber-btn-chat-active')} href="/chat">
          <MessageSquare size={16} />
          Chat
        </Link>
        <Link className={buttonClass(active, 'user', 'cyber-btn-user', 'cyber-btn-user-active')} href="/user">
          <User size={16} />
          User
        </Link>
        <Link
          className={buttonClass(active, 'leaderboards', 'cyber-btn-secondary', 'cyber-btn-solid')}
          href="/leaderboards"
        >
          <Trophy size={16} />
          Leaderboards
        </Link>
        {showAdmin ? (
          <Link className={buttonClass(active, 'admin', 'cyber-btn-admin', 'cyber-btn-admin-active')} href="/admin/users/">
            <Shield size={16} />
            Admin
          </Link>
        ) : null}
        <Link className="cyber-btn cyber-btn-danger" href="/logout">
          <LogOut size={16} />
          Logout
        </Link>
      </nav>
    </header>
  );
}
