import { createHash } from 'node:crypto';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import {
  appendChatExchange,
  getChallengeLeaderboardSnapshot,
  getChatMessages,
  getPendingAttachmentsByIds,
  getChatSession,
  getGlobalPersuasionPoints,
  getPersuasionEvidenceMemory,
  getProfileByClerkId,
  hasUserSubmissionHash,
  recordPersuasionAttempt,
  touchLastSeen,
} from '@/lib/server/db';
import { generateAssistantReply } from '@/lib/server/ai';
import { chatMessageSchema } from '@/lib/shared/validation';

const RELEVANCE_PATTERN =
  /\b(water|h2o|solid|liquid|room\s*temp(?:erature)?|temperature|phase|ice|freeze|frozen|melting|thermodynamic|atmospher|pressure|celsius|fahrenheit|deg(?:ree)?s?)\b/i;

function isAccessDenied(profile) {
  return !profile || !profile.is_verified || profile.is_disabled;
}

function clampRating(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(10, Math.round(numeric)));
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

function normalizeContentForHash(content) {
  return String(content || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildAttachmentSignature(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return [];
  }

  return attachments
    .map((attachment) => ({
      kind: String(attachment.kind || 'file').toLowerCase(),
      mime: String(attachment.mime_type || '').toLowerCase(),
      bytes: Number(attachment.byte_size || 0),
      duration: attachment.duration_seconds === null || attachment.duration_seconds === undefined
        ? null
        : Number(attachment.duration_seconds),
      file: String(attachment.original_filename || '').toLowerCase().trim(),
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function buildSubmissionHash(content, attachments) {
  const payload = {
    text: normalizeContentForHash(content),
    attachments: buildAttachmentSignature(attachments),
  };

  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function deriveInputModality(content, attachments) {
  const hasText = Boolean(String(content || '').trim());
  const kinds = new Set((attachments || []).map((attachment) => String(attachment.kind || '').toLowerCase()));
  const hasImage = kinds.has('image');
  const hasVideo = kinds.has('video');

  if (hasVideo && (hasImage || hasText)) {
    return 'mixed';
  }

  if (hasVideo) {
    return 'video';
  }

  if (hasImage && hasText) {
    return 'mixed';
  }

  if (hasImage) {
    return 'image';
  }

  if (hasText) {
    return 'text';
  }

  return 'none';
}

function isRelevantAttempt(content, attachments) {
  if (Array.isArray(attachments) && attachments.length > 0) {
    return true;
  }

  const text = String(content || '').trim();
  if (!text) {
    return false;
  }

  return RELEVANCE_PATTERN.test(text);
}

function buildOffTopicAssistantReply() {
  return 'I can only score persuasion attempts about whether water is a solid at room temperature. Please keep your next message focused on that claim.';
}

function buildDuplicateAssistantReply() {
  return 'This looks like a duplicate of an earlier attempt from you. Repeating the same evidence does not add points, so try a meaningfully different argument or media.';
}

function buildEvidencePreview(content, attachments) {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  const attachmentPreview = (attachments || [])
    .map((attachment) => `${attachment.kind}:${attachment.original_filename}`)
    .join(', ');
  const combined = [text, attachmentPreview].filter(Boolean).join(' | ');

  if (!combined) {
    return null;
  }

  return combined.slice(0, 220);
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

    const inputModalityHint = deriveInputModality(content, pendingAttachments);
    const submissionHash = buildSubmissionHash(content, pendingAttachments);
    const duplicateAttempt = await hasUserSubmissionHash({
      clerkUserId: userId,
      submissionHash,
    });
    const relevantAttempt = isRelevantAttempt(content, pendingAttachments);

    let assistantReply = '';
    let modelRating = 0;
    let awardedPoints = 0;

    if (duplicateAttempt) {
      assistantReply = buildDuplicateAssistantReply();
    } else if (!relevantAttempt) {
      assistantReply = buildOffTopicAssistantReply();
    } else {
      const [globalPersuasionPoints, evidenceMemory, existingMessages] = await Promise.all([
        getGlobalPersuasionPoints(),
        getPersuasionEvidenceMemory(100),
        getChatMessages(sessionId, userId),
      ]);

      const aiResult = await generateAssistantReply({
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
        globalPersuasionPoints,
        evidenceMemory,
        inputModalityHint,
      });

      assistantReply = String(aiResult.assistantText || '').trim();
      modelRating = clampRating(aiResult.attemptRating);
      awardedPoints = modelRating;
    }

    if (!assistantReply) {
      assistantReply = 'I could not evaluate that turn. Please try again with a clearer argument.';
    }

    const inserted = await appendChatExchange({
      sessionId,
      clerkUserId: userId,
      userMessage: content,
      assistantMessage: assistantReply,
      userAttachmentIds: attachmentIds,
    });

    const userMessageRecord = inserted.find((message) => message.role === 'user') || null;
    const assistantMessageRecord = inserted.find((message) => message.role === 'assistant') || null;

    try {
      if (userMessageRecord?.id) {
        await recordPersuasionAttempt({
          clerkUserId: userId,
          sessionId,
          userMessageId: userMessageRecord.id,
          assistantMessageId: assistantMessageRecord?.id || null,
          submissionHash,
          inputModality: inputModalityHint,
          isRelevant: relevantAttempt,
          isDuplicate: duplicateAttempt,
          modelRating,
          awardedPoints,
          evidencePreview: buildEvidencePreview(content, pendingAttachments),
          metadata: {
            attachment_count: pendingAttachments.length,
            used_model: relevantAttempt && !duplicateAttempt,
          },
        });
      }
    } catch (scoringError) {
      console.error('Failed to record persuasion score:', scoringError);
    }

    const challenge = await getChallengeLeaderboardSnapshot({ viewerUserId: userId, limit: 20 });

    await touchLastSeen(userId, false);

    return NextResponse.json({
      messages: inserted,
      assistant: assistantReply,
      challenge,
    });
  } catch (error) {
    console.error('Failed to post message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
