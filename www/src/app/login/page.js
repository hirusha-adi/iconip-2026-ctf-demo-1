import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import LoginForm from '@/components/LoginForm';

function getVerificationMessage(status) {
  switch (status) {
    case 'success':
      return 'Email verified successfully. You can now log in.';
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
    <main className="flex flex-1 items-center">
      <div className="cyber-shell-narrow">
        <LoginForm initialMessage={getVerificationMessage(verificationStatus)} nextPath={nextPath} />
      </div>
    </main>
  );
}
