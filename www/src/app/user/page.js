import Link from 'next/link';

import UserSettingsClient from '@/components/UserSettingsClient';
import { requirePageUser } from '@/lib/server/authz';

export default async function UserPage() {
  const { profile } = await requirePageUser();

  return (
    <main className="flex flex-1">
      <div className="cyber-shell">
        <header className="mb-4 flex items-center justify-end">
          <div className="flex gap-2">
            <Link className="cyber-btn cyber-btn-outline" href="/chat">
              Chat
            </Link>
            <Link className="cyber-btn cyber-btn-ghost" href="/logout">
              Logout
            </Link>
          </div>
        </header>

        <UserSettingsClient
          initialFirstName={profile.first_name}
          initialLastName={profile.last_name}
          initialEmail={profile.email}
        />
      </div>
    </main>
  );
}
