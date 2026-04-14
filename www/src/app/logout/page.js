import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import LogoutClient from '@/components/LogoutClient';

export default async function LogoutPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-6 py-14">
      <LogoutClient />
    </main>
  );
}
