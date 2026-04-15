import Link from 'next/link';
import { Home, LogIn, UserPlus } from 'lucide-react';

function getNavClass(activeKey, key, inactiveClass) {
  return activeKey === key ? 'cyber-btn cyber-btn-solid' : `cyber-btn ${inactiveClass}`;
}

export default function PublicHeader({ active = '' }) {
  return (
    <header className="cyber-page-header">
      <div>
        <p className="cyber-kicker">ICONIP 2026</p>
        <p className="cyber-page-title">CTF Demo Portal</p>
      </div>

      <nav className="cyber-page-actions" aria-label="Primary navigation">
        <Link className={getNavClass(active, 'home', 'cyber-btn-outline')} href="/">
          <Home size={16} />
          Home
        </Link>
        <Link className={getNavClass(active, 'login', 'cyber-btn-chat')} href="/login">
          <LogIn size={16} />
          Login
        </Link>
        <Link className={getNavClass(active, 'register', 'cyber-btn-secondary')} href="/register">
          <UserPlus size={16} />
          Register
        </Link>
      </nav>
    </header>
  );
}
