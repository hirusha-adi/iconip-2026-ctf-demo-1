import { NextResponse } from 'next/server';

import { createAuthEvent, consumeEmailVerificationToken, setProfileVerified } from '@/lib/server/db';
import { hashToken } from '@/lib/server/tokens';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL('/login?verified=missing_token', request.url));
    }

    const tokenHash = hashToken(token);
    const result = await consumeEmailVerificationToken(tokenHash);

    if (!result.ok) {
      return NextResponse.redirect(new URL(`/login?verified=${result.reason}`, request.url));
    }

    const updatedProfile = await setProfileVerified(result.email, true);

    await createAuthEvent({
      clerkUserId: updatedProfile?.clerk_user_id ?? null,
      email: result.email,
      eventType: 'verify_email_success',
    });

    return NextResponse.redirect(new URL('/login?verified=success&next=/setup-mfa', request.url));
  } catch (error) {
    console.error('Email verification failed:', error);
    return NextResponse.redirect(new URL('/login?verified=error', request.url));
  }
}
