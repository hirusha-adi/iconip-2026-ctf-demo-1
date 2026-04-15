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
      <div className="cyber-page-shell">
        <PublicHeader active="register" />

        <section className="cyber-page-content grid gap-4 lg:grid-cols-[minmax(0,680px)_minmax(0,1fr)] lg:items-start">
          <RegisterForm />

          <aside className="cyber-card p-6">
            <p className="cyber-kicker">Registration</p>
            <h2 className="cyber-title mt-2 text-xl font-semibold text-foreground">Create your account</h2>
            <p className="cyber-muted mt-2 text-sm">
              Register once, verify your email, then complete MFA setup to unlock full chat and admin features.
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}
