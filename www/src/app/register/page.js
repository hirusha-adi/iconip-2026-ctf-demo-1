import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import RegisterForm from '@/components/RegisterForm';

export default async function RegisterPage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/chat');
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-6 py-14">
      <RegisterForm />
    </main>
  );
}
