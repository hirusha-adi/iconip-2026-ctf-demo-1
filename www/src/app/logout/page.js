import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import LogoutClient from '@/components/LogoutClient';

export default async function LogoutPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  return (
    <main className="flex flex-1 items-center">
      <div className="cyber-shell-narrow">
        <LogoutClient />
      </div>
    </main>
  );
}
