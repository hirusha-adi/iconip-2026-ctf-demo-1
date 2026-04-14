import { NextResponse } from 'next/server';

import { getClerkClient } from '@/lib/server/clerk';
import {
  canSendVerificationEmail,
  createAuthEvent,
  createEmailVerificationToken,
  getProfileByEmail,
  normalizeEmail,
  recordVerificationEmailSent,
  upsertProfile,
} from '@/lib/server/db';
import { sendVerificationEmail } from '@/lib/server/email';
import { createToken, hashToken } from '@/lib/server/tokens';
import { registerSchema } from '@/lib/shared/validation';

export async function POST(request) {
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || 'Invalid registration data',
        },
        { status: 400 },
      );
    }

    const { firstName, lastName, email, password } = parsed.data;
    const normalizedEmail = normalizeEmail(email);

    const existingProfile = await getProfileByEmail(normalizedEmail);
    if (existingProfile) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const clerk = await getClerkClient();
    const clerkUser = await clerk.users.createUser({
      firstName,
      lastName,
      emailAddress: [normalizedEmail],
      password,
    });

    await upsertProfile({
      clerkUserId: clerkUser.id,
      firstName,
      lastName,
      email: normalizedEmail,
    });

    const rateCheck = await canSendVerificationEmail(normalizedEmail);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Please wait ${rateCheck.retryAfterSeconds}s before requesting another verification email`,
        },
        { status: 429 },
      );
    }

    const token = createToken();
    const tokenHash = hashToken(token);

    await createEmailVerificationToken(normalizedEmail, tokenHash);
    await sendVerificationEmail({ email: normalizedEmail, token });
    await recordVerificationEmailSent(normalizedEmail);

    await createAuthEvent({
      clerkUserId: clerkUser.id,
      email: normalizedEmail,
      eventType: 'register',
      userAgent,
      metadata: {
        verificationEmailSent: true,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Registration failed:', error);

    const errorMessage = error?.errors?.[0]?.message || error?.message || 'Registration failed';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
