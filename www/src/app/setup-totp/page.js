import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import SetupTotpClient from '@/components/SetupTotpClient';
import { getProfileByClerkId } from '@/lib/server/db';

function getSetupMessage(status) {
  switch (status) {
    case 'success':
      return 'Email verified. Set up your authenticator app to continue.';
    case 'already_used':
      return 'Verification link was already used. Set up TOTP to continue.';
    case 'expired':
      return 'Verification link expired. Request a new one from login.';
    case 'invalid':
      return 'Verification link is invalid.';
    case 'missing_token':
      return 'Verification link is missing token.';
    case 'error':
      return 'Verification failed. Please request a new verification email.';
    default:
      return '';
  }
}

export default async function SetupTotpPage({ searchParams }) {
  const { userId } = await auth();
  const query = await searchParams;

  if (userId) {
    const profile = await getProfileByClerkId(userId);

    if (!profile || !profile.is_verified || profile.is_disabled) {
      redirect('/login');
    }
  }

  const verifiedStatus = typeof query.verified === 'string' ? query.verified : '';

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-6 py-14">
      <SetupTotpClient verifiedMessage={getSetupMessage(verifiedStatus)} />
    </main>
  );
}
