import Link from 'next/link';

import UserSettingsClient from '@/components/UserSettingsClient';
import { requirePageUser } from '@/lib/server/authz';

export default async function UserPage() {
  const { profile } = await requirePageUser({ requireTotp: false });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center justify-end">
        <div className="flex gap-2">
          <Link className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100" href="/chat">
            Chat
          </Link>
          <Link className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100" href="/logout">
            Logout
          </Link>
        </div>
      </header>

      <UserSettingsClient
        initialFirstName={profile.first_name}
        initialLastName={profile.last_name}
        initialEmail={profile.email}
      />
    </main>
  );
}
