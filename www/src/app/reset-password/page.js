import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import PublicHeader from '@/components/PublicHeader';
import ResetPasswordForm from '@/components/ResetPasswordForm';

export default async function ResetPasswordPage({ searchParams }) {
  const query = await searchParams;
  const token = typeof query.token === 'string' ? query.token : '';
  const { userId } = await auth();

  if (userId) {
    redirect('/chat');
  }

  return (
    <main className="flex flex-1">
      <div className="cyber-page-shell">
        <PublicHeader active="login" />

        <section className="cyber-page-content grid gap-4 lg:grid-cols-[minmax(0,680px)_minmax(0,1fr)] lg:items-start">
          <ResetPasswordForm token={token} />

          <aside className="cyber-card p-6">
            <p className="cyber-kicker">Security</p>
            <h2 className="cyber-title mt-2 text-xl font-semibold text-foreground">Choose a new password</h2>
            <p className="cyber-muted mt-2 text-sm">
              Use a strong password and store it securely. Once updated, sign in again and continue with MFA.
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}
