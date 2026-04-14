import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import {
  appendChatExchange,
  getChatMessages,
  getChatSession,
  getProfileByClerkId,
  touchLastSeen,
} from '@/lib/server/db';
import { generateAssistantReply } from '@/lib/server/ai';
import { chatMessageSchema } from '@/lib/shared/validation';

function isAccessDenied(profile) {
  return !profile || !profile.is_verified || profile.is_disabled;
}

export async function POST(request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (isAccessDenied(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = chatMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid payload' }, { status: 400 });
    }

    const { sessionId, content } = parsed.data;

    const session = await getChatSession(sessionId, userId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.is_ended) {
      return NextResponse.json({ error: 'Session has already ended' }, { status: 400 });
    }

    const existingMessages = await getChatMessages(sessionId, userId);
    const assistantReply = await generateAssistantReply({
      history: [...existingMessages, { role: 'user', content }],
    });

    const inserted = await appendChatExchange({
      sessionId,
      clerkUserId: userId,
      userMessage: content,
      assistantMessage: assistantReply,
    });

    await touchLastSeen(userId, false);

    return NextResponse.json({
      messages: inserted,
      assistant: assistantReply,
    });
  } catch (error) {
    console.error('Failed to post message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
