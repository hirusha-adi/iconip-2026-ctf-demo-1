import { NextResponse } from 'next/server';

import { createAuthEvent, getProfileByEmail, normalizeEmail } from '@/lib/server/db';
import { loginSchema } from '@/lib/shared/validation';

export async function POST(request) {
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid login payload' }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const profile = await getProfileByEmail(email);

    if (!profile) {
      return NextResponse.json({ allowed: true });
    }

    if (profile.is_disabled) {
      await createAuthEvent({
        clerkUserId: profile.clerk_user_id,
        email,
        eventType: 'login_blocked_disabled',
        userAgent,
      });

      return NextResponse.json(
        {
          allowed: false,
          reason: 'disabled',
          message: profile.disabled_reason || 'This account has been disabled',
        },
        { status: 403 },
      );
    }

    if (!profile.is_verified) {
      await createAuthEvent({
        clerkUserId: profile.clerk_user_id,
        email,
        eventType: 'login_blocked_unverified',
        userAgent,
      });

      return NextResponse.json(
        {
          allowed: false,
          reason: 'unverified',
          message: 'Please verify your email before logging in',
        },
        { status: 403 },
      );
    }

    return NextResponse.json({ allowed: true });
  } catch (error) {
    console.error('Pre-login check failed:', error);
    return NextResponse.json({ error: 'Failed to validate login request' }, { status: 500 });
  }
}
