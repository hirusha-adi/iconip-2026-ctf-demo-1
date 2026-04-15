import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import LogoutClient from '@/components/LogoutClient';
import PublicHeader from '@/components/PublicHeader';

export default async function LogoutPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  return (
    <main className="flex flex-1">
      <div className="cyber-page-shell">
        <PublicHeader />

        <section className="cyber-page-content max-w-2xl">
          <LogoutClient />
        </section>
      </div>
    </main>
  );
}
