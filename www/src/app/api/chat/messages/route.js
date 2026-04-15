import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import {
  appendChatExchange,
  getChatMessages,
  getPendingAttachmentsByIds,
  getChatSession,
  getProfileByClerkId,
  touchLastSeen,
} from '@/lib/server/db';
import { generateAssistantReply } from '@/lib/server/ai';
import { chatMessageSchema } from '@/lib/shared/validation';

function isAccessDenied(profile) {
  return !profile || !profile.is_verified || profile.is_disabled;
}

function buildAttachmentContext(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return '';
  }

  const lines = attachments.map((attachment, index) => {
    if (attachment.kind === 'video') {
      const duration = attachment.duration_seconds ? `${attachment.duration_seconds}s` : 'unknown duration';
      return `${index + 1}. Video: ${attachment.original_filename} (${duration})`;
    }

    return `${index + 1}. Image: ${attachment.original_filename}`;
  });

  return `User attached files:\n${lines.join('\n')}`;
}

function toModelMessageContent(content, attachments = []) {
  const trimmedContent = String(content || '').trim();
  const attachmentContext = buildAttachmentContext(attachments);

  if (trimmedContent && attachmentContext) {
    return `${trimmedContent}\n\n${attachmentContext}`;
  }

  if (trimmedContent) {
    return trimmedContent;
  }

  if (attachmentContext) {
    return `${attachmentContext}\n\nNo text message was provided.`;
  }

  return 'No content.';
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

    const { sessionId, content, attachmentIds } = parsed.data;

    const session = await getChatSession(sessionId, userId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.is_ended) {
      return NextResponse.json({ error: 'Session has already ended' }, { status: 400 });
    }

    const pendingAttachments = await getPendingAttachmentsByIds({
      attachmentIds,
      sessionId,
      clerkUserId: userId,
    });

    const uniqueAttachmentCount = new Set(attachmentIds || []).size;
    if (pendingAttachments.length !== uniqueAttachmentCount) {
      return NextResponse.json({ error: 'One or more attachments are invalid or no longer available' }, { status: 400 });
    }

    const existingMessages = await getChatMessages(sessionId, userId);
    const assistantReply = await generateAssistantReply({
      history: [
        ...existingMessages.map((message) => ({
          role: message.role,
          content: toModelMessageContent(message.content, message.attachments || []),
        })),
        {
          role: 'user',
          content: toModelMessageContent(content, pendingAttachments),
        },
      ],
    });

    const inserted = await appendChatExchange({
      sessionId,
      clerkUserId: userId,
      userMessage: content,
      assistantMessage: assistantReply,
      userAttachmentIds: attachmentIds,
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
