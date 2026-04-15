import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  createChatAttachment,
  getAttachmentUploadAllowance,
  getChatSession,
  getProfileByClerkId,
  touchLastSeen,
} from '@/lib/server/db';
import {
  sanitizeAttachmentFileName,
  uploadAttachmentToSupabaseStorage,
  validateAndNormalizeAttachment,
  deleteAttachmentFromSupabaseStorage,
} from '@/lib/server/chat-attachments';

const sessionIdSchema = z.string().uuid('Invalid session id');

function isAccessDenied(profile) {
  return !profile || !profile.is_verified || profile.is_disabled;
}

export async function POST(request) {
  let uploaded = null;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (isAccessDenied(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const sessionIdValue = String(formData.get('sessionId') || '').trim();
    const parsedSessionId = sessionIdSchema.safeParse(sessionIdValue);

    if (!parsedSessionId.success) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Attachment file is required' }, { status: 400 });
    }

    const session = await getChatSession(parsedSessionId.data, userId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.is_ended) {
      return NextResponse.json({ error: 'Session has already ended' }, { status: 400 });
    }

    const allowance = await getAttachmentUploadAllowance(userId);
    if (!allowance.allowed) {
      return NextResponse.json(
        {
          error: `Attachment upload limit reached. You can upload up to ${allowance.limit} files per hour.`,
        },
        { status: 429 },
      );
    }

    const validated = await validateAndNormalizeAttachment(file);
    const safeFileName = sanitizeAttachmentFileName(file.name, validated.extension);

    uploaded = await uploadAttachmentToSupabaseStorage({
      fileName: safeFileName,
      mimeType: validated.mimeType,
      data: validated.buffer,
      clerkUserId: userId,
      sessionId: parsedSessionId.data,
    });

    const attachment = await createChatAttachment({
      sessionId: parsedSessionId.data,
      clerkUserId: userId,
      kind: validated.kind,
      originalFilename: safeFileName,
      mimeType: validated.mimeType,
      byteSize: validated.byteSize,
      durationSeconds: validated.durationSeconds,
      storageBucket: uploaded.bucketName,
      storagePath: uploaded.storagePath,
      storageFileUrl: uploaded.publicUrl,
    });

    await touchLastSeen(userId, false);

    return NextResponse.json({
      attachment,
      rateLimit: {
        limit: allowance.limit,
        used: allowance.used + 1,
        remaining: Math.max(0, allowance.remaining - 1),
      },
    });
  } catch (error) {
    if (uploaded) {
      try {
        await deleteAttachmentFromSupabaseStorage({
          bucketName: uploaded.bucketName,
          storagePath: uploaded.storagePath,
        });
      } catch (cleanupError) {
        console.error('Failed to rollback attachment upload:', cleanupError);
      }
    }

    console.error('Failed to upload attachment:', error);

    const message = String(error?.message || 'Failed to upload attachment');
    const isClientError =
      message.includes('Attachment') ||
      message.includes('Only PNG') ||
      message.includes('MIME type') ||
      message.includes('Video attachments') ||
      message.includes('Image attachments') ||
      message.includes('Could not read MP4');

    return NextResponse.json({ error: message }, { status: isClientError ? 400 : 500 });
  }
}
