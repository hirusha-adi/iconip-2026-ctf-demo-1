import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { getProfileByClerkId, touchLastSeen } from '@/lib/server/db';

export async function getCurrentAuth() {
  return auth();
}

export async function getCurrentUserProfile() {
  const { userId } = await getCurrentAuth();

  if (!userId) {
    return null;
  }

  return getProfileByClerkId(userId);
}

export async function requirePageUser() {
  const { userId } = await getCurrentAuth();

  if (!userId) {
    redirect('/login');
  }

  const profile = await getProfileByClerkId(userId);

  if (!profile || !profile.is_verified || profile.is_disabled) {
    redirect('/login');
  }

  await touchLastSeen(userId, false);

  return { userId, profile };
}

export async function requirePageAdmin() {
  const { userId, profile } = await requirePageUser();

  if (!profile.is_admin) {
    redirect('/404');
  }

  return { userId, profile };
}

export async function getApiUserContext() {
  const { userId } = await getCurrentAuth();

  if (!userId) {
    return { userId: null, profile: null };
  }

  const profile = await getProfileByClerkId(userId);
  return { userId, profile };
}
