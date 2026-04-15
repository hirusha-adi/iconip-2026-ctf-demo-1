import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import {
  getPendingAttachmentForUser,
  getProfileByClerkId,
  softDeletePendingAttachment,
  touchLastSeen,
} from '@/lib/server/db';
import { deleteAttachmentFromSupabaseStorage } from '@/lib/server/chat-attachments';

function isAccessDenied(profile) {
  return !profile || !profile.is_verified || profile.is_disabled;
}

export async function DELETE(_request, { params }) {
  try {
    const { attachmentId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (isAccessDenied(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const attachment = await getPendingAttachmentForUser(attachmentId, userId);
    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    await deleteAttachmentFromSupabaseStorage({
      bucketName: attachment.storage_bucket,
      storagePath: attachment.storage_path,
    });

    const deleted = await softDeletePendingAttachment(attachmentId, userId);
    if (!deleted) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    await touchLastSeen(userId, false);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete attachment:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete attachment' }, { status: 500 });
  }
}
