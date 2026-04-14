import { NextResponse } from 'next/server';

import {
  canSendPasswordResetEmail,
  createAuthEvent,
  createPasswordResetToken,
  getProfileByEmail,
  normalizeEmail,
  recordPasswordResetEmailSent,
} from '@/lib/server/db';
import { sendPasswordResetEmail } from '@/lib/server/email';
import { createToken, hashToken } from '@/lib/server/tokens';
import { forgotPasswordSchema } from '@/lib/shared/validation';

const GENERIC_RESPONSE = {
  ok: true,
  message: 'If an account exists for this email, check your inbox for a password reset link.',
};

export async function POST(request) {
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const profile = await getProfileByEmail(email);

    if (!profile) {
      await createAuthEvent({
        clerkUserId: null,
        email,
        eventType: 'forgot_password_unknown_email',
        userAgent,
      });
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const rateCheck = await canSendPasswordResetEmail(email);
    if (!rateCheck.allowed) {
      await createAuthEvent({
        clerkUserId: profile.clerk_user_id,
        email,
        eventType: 'forgot_password_rate_limited',
        userAgent,
      });
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const token = createToken();
    const tokenHash = hashToken(token);

    await createPasswordResetToken({
      email,
      clerkUserId: profile.clerk_user_id,
      tokenHash,
    });
    await sendPasswordResetEmail({ email, token });
    await recordPasswordResetEmailSent(email);

    await createAuthEvent({
      clerkUserId: profile.clerk_user_id,
      email,
      eventType: 'forgot_password_email_sent',
      userAgent,
    });

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error('Forgot password request failed:', error);
    return NextResponse.json(GENERIC_RESPONSE);
  }
}
