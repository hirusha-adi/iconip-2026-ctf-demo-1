import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { createAuthEvent, getProfileByClerkId } from '@/lib/server/db';

export async function POST(request) {
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ ok: true });
    }

    const profile = await getProfileByClerkId(userId);

    await createAuthEvent({
      clerkUserId: userId,
      email: profile?.email ?? null,
      eventType: 'logout',
      userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to write logout audit:', error);
    return NextResponse.json({ error: 'Failed to write logout audit' }, { status: 500 });
  }
}
