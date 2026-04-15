import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import LoginForm from '@/components/LoginForm';
import PublicHeader from '@/components/PublicHeader';

function getVerificationMessage(status) {
  switch (status) {
    case 'success':
      return 'Email verified successfully. Log in to continue MFA setup.';
    case 'expired':
      return 'Verification link expired. Request a new one below.';
    case 'already_used':
      return 'Verification link has already been used.';
    case 'invalid':
      return 'Verification link is invalid.';
    case 'missing_token':
      return 'Verification link is missing token.';
    case 'error':
      return 'Verification failed. Please request a new email.';
    default:
      return '';
  }
}

export default async function LoginPage({ searchParams }) {
  const query = await searchParams;
  const rawNextPath = typeof query.next === 'string' ? query.next : '';
  const nextPath = rawNextPath.startsWith('/') && !rawNextPath.startsWith('//') ? rawNextPath : '';
  const { userId } = await auth();

  if (userId) {
    redirect(nextPath || '/chat');
  }

  const verificationStatus = typeof query.verified === 'string' ? query.verified : '';

  return (
    <main className="flex flex-1">
      <div className="cyber-page-shell">
        <PublicHeader active="login" />

        <section className="cyber-page-content grid gap-4 lg:grid-cols-[minmax(0,680px)_minmax(0,1fr)] lg:items-start">
          <LoginForm initialMessage={getVerificationMessage(verificationStatus)} nextPath={nextPath} />

          <aside className="cyber-card p-6">
            <p className="cyber-kicker">Authentication</p>
            <h2 className="cyber-title mt-2 text-xl font-semibold text-foreground">Secure sign-in flow</h2>
            <p className="cyber-muted mt-2 text-sm">
              Use email and password, then complete second-factor verification with authenticator app, backup code, or
              email code.
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}
