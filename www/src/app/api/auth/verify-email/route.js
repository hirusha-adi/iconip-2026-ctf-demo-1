import { NextResponse } from 'next/server';

import { createAuthEvent, consumeEmailVerificationToken, setProfileVerified } from '@/lib/server/db';
import { APP_BASE_URL } from '@/lib/server/env';
import { hashToken } from '@/lib/server/tokens';

function redirectTo(pathnameWithQuery) {
  return NextResponse.redirect(new URL(pathnameWithQuery, APP_BASE_URL));
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return redirectTo('/login?verified=missing_token');
    }

    const tokenHash = hashToken(token);
    const result = await consumeEmailVerificationToken(tokenHash);

    if (!result.ok) {
      return redirectTo(`/login?verified=${result.reason}`);
    }

    const updatedProfile = await setProfileVerified(result.email, true);

    await createAuthEvent({
      clerkUserId: updatedProfile?.clerk_user_id ?? null,
      email: result.email,
      eventType: 'verify_email_success',
    });

    return redirectTo('/login?verified=success&next=/setup-mfa');
  } catch (error) {
    console.error('Email verification failed:', error);
    return redirectTo('/login?verified=error');
  }
}
