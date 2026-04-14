import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import ResetPasswordForm from '@/components/ResetPasswordForm';

export default async function ResetPasswordPage({ searchParams }) {
  const query = await searchParams;
  const token = typeof query.token === 'string' ? query.token : '';
  const { userId } = await auth();

  if (userId) {
    redirect('/chat');
  }

  return (
    <main className="flex flex-1 items-center">
      <div className="cyber-shell-narrow">
        <ResetPasswordForm token={token} />
      </div>
    </main>
  );
}
