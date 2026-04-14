import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import ForgotPasswordForm from '@/components/ForgotPasswordForm';

export default async function ForgotPasswordPage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/chat');
  }

  return (
    <main className="flex flex-1 items-center">
      <div className="cyber-shell-narrow">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
