import { NextResponse } from 'next/server';

import { getClerkClient } from '@/lib/server/clerk';
import { consumePasswordResetToken, createAuthEvent } from '@/lib/server/db';
import { hashToken } from '@/lib/server/tokens';
import { resetPasswordSchema } from '@/lib/shared/validation';

function getClerkErrorMessage(error) {
  const issue = error?.errors?.[0];
  return issue?.longMessage || issue?.message || error?.message || 'Failed to reset password';
}

export async function POST(request) {
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid reset payload' },
        { status: 400 },
      );
    }

    const tokenHash = hashToken(parsed.data.token);
    const consumed = await consumePasswordResetToken(tokenHash);

    if (!consumed.ok) {
      return NextResponse.json(
        { error: 'Reset link is invalid or expired. Please request a new one.' },
        { status: 400 },
      );
    }

    if (!consumed.clerkUserId) {
      return NextResponse.json(
        { error: 'Reset link is invalid. Please request a new one.' },
        { status: 400 },
      );
    }

    const clerk = await getClerkClient();
    await clerk.users.updateUser(consumed.clerkUserId, {
      password: parsed.data.password,
    });

    await createAuthEvent({
      clerkUserId: consumed.clerkUserId,
      email: consumed.email,
      eventType: 'password_reset_success',
      userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Reset password failed:', error);
    return NextResponse.json({ error: getClerkErrorMessage(error) }, { status: 400 });
  }
}
