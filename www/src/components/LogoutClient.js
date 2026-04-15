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
    <div className="cyber-card cyber-terminal mx-auto w-full max-w-sm p-6 text-center">
      <p className="cyber-kicker">Session Exit</p>
      <h1 className="cyber-title mt-2 text-xl font-semibold text-foreground">Logging out...</h1>
      {error ? <p className="cyber-note cyber-note-error mt-3">{error}</p> : null}
    </div>
  );
}
