'use client';

import { useClerk } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

export default function LogoutClient() {
  const { signOut } = useClerk();
  const [error, setError] = useState('');

  useEffect(() => {
    async function performLogout() {
      try {
        await fetch('/api/auth/logout-audit', {
          method: 'POST',
        });

        await signOut({ redirectUrl: '/login' });
      } catch (logoutError) {
        setError(logoutError.message || 'Failed to logout');
      }
    }

    performLogout();
  }, [signOut]);

  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
      <h1 className="text-xl font-semibold text-zinc-900">Logging out...</h1>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
