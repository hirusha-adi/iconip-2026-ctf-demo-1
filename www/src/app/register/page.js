import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import RegisterForm from '@/components/RegisterForm';

export default async function RegisterPage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/chat');
  }

  return (
    <main className="flex flex-1 items-center">
      <div className="cyber-shell-narrow">
        <RegisterForm />
      </div>
    </main>
  );
}
