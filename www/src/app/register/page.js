import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import PublicHeader from '@/components/PublicHeader';
import RegisterForm from '@/components/RegisterForm';

export default async function RegisterPage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/chat');
  }

  return (
    <main className="flex flex-1">
      <div className="cyber-page-shell flex flex-1 flex-col">
        <PublicHeader active="register" />

        <section className="cyber-page-content flex flex-1 items-center justify-center px-2 py-6">
          <div className="w-full max-w-xl">
            <RegisterForm />
          </div>
        </section>
      </div>
    </main>
  );
}
