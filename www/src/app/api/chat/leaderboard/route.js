import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { getChallengeLeaderboardSnapshot, getProfileByClerkId, touchLastSeen } from '@/lib/server/db';

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

    const challenge = await getChallengeLeaderboardSnapshot({ viewerUserId: userId, limit: 20 });
    await touchLastSeen(userId, false);

    return NextResponse.json({ challenge });
  } catch (error) {
    console.error('Failed to load leaderboard:', error);
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
}
