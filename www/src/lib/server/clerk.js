import 'server-only';

import { clerkClient } from '@clerk/nextjs/server';

export async function getClerkClient() {
  if (typeof clerkClient === 'function') {
    return clerkClient();
  }

  return clerkClient;
}

export async function safeUpdateClerkUser(userId, data) {
  const client = await getClerkClient();

  try {
    await client.users.updateUser(userId, data);
  } catch (error) {
    console.error('Failed to update Clerk user:', error);
  }
}

export async function getClerkUserById(userId) {
  const client = await getClerkClient();
  return client.users.getUser(userId);
}

export async function safeSetDisabledState(userId, shouldDisable) {
  const client = await getClerkClient();

  try {
    if (shouldDisable) {
      await client.users.banUser?.(userId);
      return;
    }

    await client.users.unbanUser?.(userId);
  } catch (error) {
    console.error('Failed to update Clerk disabled state:', error);
  }
}
