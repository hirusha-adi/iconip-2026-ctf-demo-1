import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { createAuthEvent, getProfileByClerkId, touchLastSeen } from '@/lib/server/db';

export async function POST(request) {
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);

    await touchLastSeen(userId, true);
    await createAuthEvent({
      clerkUserId: userId,
      email: profile?.email ?? null,
      eventType: 'login_success',
      userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to write login audit:', error);
    return NextResponse.json({ error: 'Failed to write login audit' }, { status: 500 });
  }
}
