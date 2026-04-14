import Link from 'next/link';

import { requirePageAdmin } from '@/lib/server/authz';

export default async function AdminLayout({ children }) {
  const { profile } = await requirePageAdmin();

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Admin Panel</h1>
          <p className="text-xs text-zinc-500">Signed in as {profile.email}</p>
        </div>
        <div className="flex gap-2">
          <Link className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100" href="/chat">
            Chat
          </Link>
          <Link className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100" href="/logout">
            Logout
          </Link>
        </div>
      </header>

      {children}
    </div>
  );
}
