import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { createChatSession, getProfileByClerkId, getUserChatSessions, touchLastSeen } from '@/lib/server/db';

function isAccessDenied(profile) {
  return !profile || !profile.is_verified || profile.is_disabled;
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (isAccessDenied(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sessions = await getUserChatSessions(userId);
    await touchLastSeen(userId, false);

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Failed to load sessions:', error);
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (isAccessDenied(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const session = await createChatSession(userId);
    await touchLastSeen(userId, false);

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error('Failed to create session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
