import { NextResponse } from 'next/server';

import {
  canSendVerificationEmail,
  createAuthEvent,
  createEmailVerificationToken,
  getProfileByEmail,
  normalizeEmail,
  recordVerificationEmailSent,
} from '@/lib/server/db';
import { sendVerificationEmail } from '@/lib/server/email';
import { createToken, hashToken } from '@/lib/server/tokens';
import { resendVerificationSchema } from '@/lib/shared/validation';

export async function POST(request) {
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const body = await request.json();
    const parsed = resendVerificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const profile = await getProfileByEmail(email);

    if (!profile) {
      return NextResponse.json({ ok: true });
    }

    if (profile.is_verified) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    const rateCheck = await canSendVerificationEmail(email);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Please wait ${rateCheck.retryAfterSeconds}s before sending another verification email`,
        },
        { status: 429 },
      );
    }

    const token = createToken();
    const tokenHash = hashToken(token);

    await createEmailVerificationToken(email, tokenHash);
    await sendVerificationEmail({ email, token });
    await recordVerificationEmailSent(email);

    await createAuthEvent({
      clerkUserId: profile.clerk_user_id,
      email,
      eventType: 'resend_verification_email',
      userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to resend verification email:', error);
    return NextResponse.json({ error: 'Failed to resend verification email' }, { status: 500 });
  }
}
