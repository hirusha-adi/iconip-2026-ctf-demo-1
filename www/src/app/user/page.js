import Link from 'next/link';

import UserSettingsClient from '@/components/UserSettingsClient';
import { requirePageUser } from '@/lib/server/authz';

export default async function UserPage() {
  const { profile } = await requirePageUser();

  return (
    <main className="flex flex-1">
      <div className="cyber-shell">
        <header className="mb-4 flex items-center justify-between">
          <Link className="cyber-btn cyber-btn-outline" href="/chat">
            Chat
          </Link>
          <Link className="cyber-btn cyber-btn-ghost" href="/logout">
            Logout
          </Link>
        </header>

        <div className="flex justify-center">
          <UserSettingsClient
            initialFirstName={profile.first_name}
            initialLastName={profile.last_name}
            initialEmail={profile.email}
          />
        </div>
      </div>
    </main>
  );
}
