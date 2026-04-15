import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import ForgotPasswordForm from '@/components/ForgotPasswordForm';
import PublicHeader from '@/components/PublicHeader';

export default async function ForgotPasswordPage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/chat');
  }

  return (
    <main className="flex flex-1">
      <div className="cyber-page-shell">
        <PublicHeader active="login" />

        <section className="cyber-page-content grid gap-4 lg:grid-cols-[minmax(0,680px)_minmax(0,1fr)] lg:items-start">
          <ForgotPasswordForm />

          <aside className="cyber-card p-6">
            <p className="cyber-kicker">Recovery</p>
            <h2 className="cyber-title mt-2 text-xl font-semibold text-foreground">Reset access</h2>
            <p className="cyber-muted mt-2 text-sm">
              Submit your email to receive a secure reset link. For account privacy, the response is always generic.
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}
