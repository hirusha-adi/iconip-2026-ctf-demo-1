import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { endChatSession, getChatMessages, getProfileByClerkId, touchLastSeen } from '@/lib/server/db';

function isAccessDenied(profile) {
  return !profile || !profile.is_verified || profile.is_disabled;
}

export async function GET(_request, { params }) {
  try {
    const { sessionId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (isAccessDenied(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const messages = await getChatMessages(sessionId, userId);
    await touchLastSeen(userId, false);

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Failed to load messages:', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

export async function PATCH(_request, { params }) {
  try {
    const { sessionId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (isAccessDenied(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const session = await endChatSession(sessionId, userId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await touchLastSeen(userId, false);

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Failed to end session:', error);
    return NextResponse.json({ error: 'Failed to end session' }, { status: 500 });
  }
}
