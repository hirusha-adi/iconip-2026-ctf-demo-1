import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { createAuthEvent, getProfileByClerkId, normalizeEmail, syncUserProfileFromClerk } from '@/lib/server/db';

export async function POST(request) {
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);

    if (!profile || profile.is_disabled) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const email = normalizeEmail(String(body.email || profile.email || '').trim());

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: 'Invalid profile payload' }, { status: 400 });
    }

    await syncUserProfileFromClerk({
      clerkUserId: userId,
      firstName,
      lastName,
      email,
    });

    await createAuthEvent({
      clerkUserId: userId,
      email,
      eventType: 'self_profile_update',
      userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to sync user profile:', error);
    return NextResponse.json({ error: 'Failed to sync profile' }, { status: 500 });
  }
}
