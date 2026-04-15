import 'server-only';

import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
const ONLINE_WINDOW_MINUTES = 5;
const ONE_HOUR_IN_MS = 60 * 60 * 1000;
const ATTACHMENT_HOURLY_LIMIT = 3;
const CHALLENGE_GOAL_CONFIDENCE_PERCENT = 90;
const CHALLENGE_SCHEMA_ERROR_CODES = new Set(['42P01', '42703', '42883']);

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(10, Math.round(numeric)));
}

function calculateGlobalConfidencePercent(points) {
  const numeric = Number(points);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.min(CHALLENGE_GOAL_CONFIDENCE_PERCENT, Math.round((numeric / 10) * 10) / 10);
}

function buildProfileDisplayName(profile) {
  const firstName = String(profile?.first_name || '').trim();
  const lastName = String(profile?.last_name || '').trim();

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }

  if (firstName) {
    return firstName;
  }

  if (lastName) {
    return lastName;
  }

  const email = String(profile?.email || '').trim();
  if (email) {
    return email;
  }

  return 'Participant';
}

function isMissingChallengeSchemaError(error) {
  return CHALLENGE_SCHEMA_ERROR_CODES.has(String(error?.code || ''));
}

function buildEmptyChallengeSnapshot({ viewerUserId = null } = {}) {
  return {
    globalPoints: 0,
    globalConfidencePercent: 0,
    goalConfidencePercent: CHALLENGE_GOAL_CONFIDENCE_PERCENT,
    goalReached: false,
    participantCount: 0,
    leaderboard: [],
    viewer: viewerUserId
      ? {
          rank: null,
          clerkUserId: viewerUserId,
          displayName: 'You',
          email: '',
          points: 0,
          contributionPercent: 0,
          isCurrentUser: true,
          inTopLeaderboard: false,
        }
      : null,
    updatedAt: null,
  };
}

function isNoRowsError(error) {
  return error?.code === 'PGRST116';
}

function toPublicAttachment(attachment) {
  return {
    id: attachment.id,
    message_id: attachment.message_id,
    session_id: attachment.session_id,
    clerk_user_id: attachment.clerk_user_id,
    kind: attachment.kind,
    original_filename: attachment.original_filename,
    mime_type: attachment.mime_type,
    byte_size: attachment.byte_size,
    duration_seconds: attachment.duration_seconds,
    url: attachment.storage_file_url,
    created_at: attachment.created_at,
  };
}

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export async function getProfileByEmail(email) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', normalizeEmail(email))
    .is('deleted_at', null)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return data ?? null;
}

export async function getProfileByClerkId(clerkUserId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return data ?? null;
}

export async function upsertProfile({ clerkUserId, firstName, lastName, email }) {
  const supabase = getSupabaseAdmin();

  const payload = {
    clerk_user_id: clerkUserId,
    first_name: firstName,
    last_name: lastName,
    email: normalizeEmail(email),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'clerk_user_id' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function setProfileVerified(email, isVerified = true) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('profiles')
    .update({
      is_verified: isVerified,
      verified_at: isVerified ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('email', normalizeEmail(email))
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return data ?? null;
}

export async function touchLastSeen(clerkUserId, includeLogin = false) {
  const supabase = getSupabaseAdmin();

  const payload = {
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (includeLogin) {
    payload.last_login_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('clerk_user_id', clerkUserId)
    .is('deleted_at', null);

  if (error) {
    throw error;
  }
}

export async function createAuthEvent({ clerkUserId = null, email = null, eventType, userAgent = null, metadata = {} }) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from('auth_events').insert({
    clerk_user_id: clerkUserId,
    email: email ? normalizeEmail(email) : null,
    event_type: eventType,
    user_agent: userAgent,
    metadata,
  });

  if (error) {
    throw error;
  }
}

export async function createRouteAccessLog({ clerkUserId = null, path, method = 'GET', status = 'ok', userAgent = null, metadata = {} }) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from('route_access_logs').insert({
    clerk_user_id: clerkUserId,
    path,
    method,
    status,
    user_agent: userAgent,
    metadata,
  });

  if (error) {
    throw error;
  }
}

export async function canSendVerificationEmail(email) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('verification_email_events')
    .select('sent_at')
    .eq('email', normalizeEmail(email))
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  if (!data?.sent_at) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const elapsed = Date.now() - new Date(data.sent_at).getTime();
  if (elapsed >= FIVE_MINUTES_IN_MS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((FIVE_MINUTES_IN_MS - elapsed) / 1000),
  };
}

export async function recordVerificationEmailSent(email) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from('verification_email_events').insert({
    email: normalizeEmail(email),
  });

  if (error) {
    throw error;
  }
}

export async function createEmailVerificationToken(email, tokenHash) {
  const supabase = getSupabaseAdmin();

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('email_verification_tokens').insert({
    email: normalizeEmail(email),
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) {
    throw error;
  }
}

export async function consumeEmailVerificationToken(tokenHash) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('email_verification_tokens')
    .select('id, email, expires_at, consumed_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  if (!data) {
    return { ok: false, reason: 'invalid' };
  }

  if (data.consumed_at) {
    return { ok: false, reason: 'already_used' };
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  const { error: updateError } = await supabase
    .from('email_verification_tokens')
    .update({ consumed_at: now })
    .eq('id', data.id)
    .is('consumed_at', null);

  if (updateError) {
    throw updateError;
  }

  return { ok: true, email: data.email };
}

export async function canSendPasswordResetEmail(email) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('password_reset_email_events')
    .select('sent_at')
    .eq('email', normalizeEmail(email))
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  if (!data?.sent_at) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const elapsed = Date.now() - new Date(data.sent_at).getTime();
  if (elapsed >= FIVE_MINUTES_IN_MS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((FIVE_MINUTES_IN_MS - elapsed) / 1000),
  };
}

export async function recordPasswordResetEmailSent(email) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from('password_reset_email_events').insert({
    email: normalizeEmail(email),
  });

  if (error) {
    throw error;
  }
}

export async function createPasswordResetToken({ email, clerkUserId, tokenHash }) {
  const supabase = getSupabaseAdmin();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('password_reset_tokens').insert({
    email: normalizeEmail(email),
    clerk_user_id: clerkUserId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) {
    throw error;
  }
}

export async function consumePasswordResetToken(tokenHash) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('password_reset_tokens')
    .select('id, email, clerk_user_id, expires_at, consumed_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  if (!data) {
    return { ok: false, reason: 'invalid' };
  }

  if (data.consumed_at) {
    return { ok: false, reason: 'already_used' };
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  const { error: updateError } = await supabase
    .from('password_reset_tokens')
    .update({ consumed_at: now })
    .eq('id', data.id)
    .is('consumed_at', null);

  if (updateError) {
    throw updateError;
  }

  return { ok: true, email: data.email, clerkUserId: data.clerk_user_id };
}

export async function addChatMessage({ sessionId, clerkUserId, role, content }) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      clerk_user_id: clerkUserId,
      role,
      content,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getAttachmentUploadAllowance(clerkUserId) {
  const supabase = getSupabaseAdmin();
  const windowStart = new Date(Date.now() - ONE_HOUR_IN_MS).toISOString();

  const { count, error } = await supabase
    .from('chat_message_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('clerk_user_id', clerkUserId)
    .gte('created_at', windowStart);

  if (error) {
    throw error;
  }

  const used = count ?? 0;
  const remaining = Math.max(0, ATTACHMENT_HOURLY_LIMIT - used);

  return {
    used,
    remaining,
    limit: ATTACHMENT_HOURLY_LIMIT,
    allowed: remaining > 0,
  };
}

export async function createChatAttachment({
  sessionId,
  clerkUserId,
  kind,
  originalFilename,
  mimeType,
  byteSize,
  durationSeconds = null,
  storageBucket,
  storagePath,
  storageFileUrl,
  metadata = {},
}) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('chat_message_attachments')
    .insert({
      session_id: sessionId,
      clerk_user_id: clerkUserId,
      kind,
      original_filename: originalFilename,
      mime_type: mimeType,
      byte_size: byteSize,
      duration_seconds: durationSeconds,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      storage_file_url: storageFileUrl,
      metadata,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return toPublicAttachment(data);
}

export async function getPendingAttachmentForUser(attachmentId, clerkUserId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('chat_message_attachments')
    .select('*')
    .eq('id', attachmentId)
    .eq('clerk_user_id', clerkUserId)
    .is('deleted_at', null)
    .is('message_id', null)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return data ?? null;
}

export async function getPendingAttachmentsByIds({ attachmentIds, sessionId, clerkUserId }) {
  if (!Array.isArray(attachmentIds) || attachmentIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const uniqueIds = [...new Set(attachmentIds)];

  const { data, error } = await supabase
    .from('chat_message_attachments')
    .select('*')
    .in('id', uniqueIds)
    .eq('session_id', sessionId)
    .eq('clerk_user_id', clerkUserId)
    .is('deleted_at', null)
    .is('message_id', null)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function attachPendingFilesToMessage({ attachmentIds, messageId, sessionId, clerkUserId }) {
  if (!Array.isArray(attachmentIds) || attachmentIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const uniqueIds = [...new Set(attachmentIds)];

  const { data, error } = await supabase
    .from('chat_message_attachments')
    .update({
      message_id: messageId,
    })
    .in('id', uniqueIds)
    .eq('session_id', sessionId)
    .eq('clerk_user_id', clerkUserId)
    .is('deleted_at', null)
    .is('message_id', null)
    .select('*');

  if (error) {
    throw error;
  }

  return (data ?? []).map(toPublicAttachment);
}

export async function softDeletePendingAttachment(attachmentId, clerkUserId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('chat_message_attachments')
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq('id', attachmentId)
    .eq('clerk_user_id', clerkUserId)
    .is('deleted_at', null)
    .is('message_id', null)
    .select('*')
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return data ?? null;
}

export async function createChatSession(clerkUserId, title = 'New session') {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      clerk_user_id: clerkUserId,
      title,
      is_ended: false,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getUserChatSessions(clerkUserId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function getChatSession(sessionId, clerkUserId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('clerk_user_id', clerkUserId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return data ?? null;
}

export async function endChatSession(sessionId, clerkUserId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('chat_sessions')
    .update({
      is_ended: true,
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('clerk_user_id', clerkUserId)
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return data ?? null;
}

export async function updateChatSessionTitle(sessionId, clerkUserId, title) {
  const supabase = getSupabaseAdmin();

  const trimmedTitle = String(title || '').trim();
  if (!trimmedTitle) {
    return null;
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .update({
      title: trimmedTitle,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('clerk_user_id', clerkUserId)
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return data ?? null;
}

async function hydrateMessagesWithAttachments(messages, clerkUserId) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const messageIds = messages.map((message) => message.id);
  const assistantMessageIds = messages
    .filter((message) => message.role === 'assistant')
    .map((message) => message.id);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('chat_message_attachments')
    .select('*')
    .in('message_id', messageIds)
    .eq('clerk_user_id', clerkUserId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const attachmentsByMessageId = new Map();
  for (const row of data ?? []) {
    const key = row.message_id;
    if (!attachmentsByMessageId.has(key)) {
      attachmentsByMessageId.set(key, []);
    }
    attachmentsByMessageId.get(key).push(toPublicAttachment(row));
  }

  const scoreByAssistantMessageId = new Map();
  if (assistantMessageIds.length) {
    const { data: scoreRows, error: scoreError } = await supabase
      .from('persuasion_attempts')
      .select('assistant_message_id, model_rating, awarded_points, submission_hash, input_modality, is_relevant, is_duplicate, metadata, created_at')
      .eq('clerk_user_id', clerkUserId)
      .in('assistant_message_id', assistantMessageIds)
      .order('created_at', { ascending: false });

    if (scoreError) {
      if (!isMissingChallengeSchemaError(scoreError)) {
        throw scoreError;
      }
    } else {
      for (const row of scoreRows ?? []) {
        const messageId = row.assistant_message_id;
        if (!messageId || scoreByAssistantMessageId.has(messageId)) {
          continue;
        }

        const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        const scoreMissing = Boolean(metadata.score_missing);
        scoreByAssistantMessageId.set(messageId, {
          score: scoreMissing ? null : clampScore(row.model_rating),
          missing: scoreMissing,
          source: Boolean(metadata.score_fallback_applied) ? 'fallback' : 'model',
          debug: {
            raw_output: typeof metadata.ai_raw_output === 'string' ? metadata.ai_raw_output : '',
            canonical_output: typeof metadata.ai_canonical_output === 'string' ? metadata.ai_canonical_output : '',
            rating_line: typeof metadata.ai_rating_line === 'string' ? metadata.ai_rating_line : '',
            had_explicit_rating: Boolean(metadata.ai_had_explicit_rating),
            score_fallback_applied: Boolean(metadata.score_fallback_applied),
            input_modality_hint: String(row.input_modality || 'none'),
            relevant_by_keyword: Boolean(metadata.relevant_by_keyword),
            submission_hash: String(row.submission_hash || ''),
            awarded_points: clampScore(row.awarded_points),
            model_rating: clampScore(row.model_rating),
            is_relevant: Boolean(row.is_relevant),
            is_duplicate: Boolean(row.is_duplicate),
          },
        });
      }
    }
  }

  return messages.map((message) => ({
    ...message,
    attachments: attachmentsByMessageId.get(message.id) ?? [],
    ai_score:
      message.role === 'assistant'
        ? (scoreByAssistantMessageId.get(message.id)?.score ?? null)
        : null,
    ai_score_missing:
      message.role === 'assistant'
        ? (scoreByAssistantMessageId.get(message.id)?.missing ?? !scoreByAssistantMessageId.has(message.id))
        : false,
    ai_score_source:
      message.role === 'assistant'
        ? (scoreByAssistantMessageId.get(message.id)?.source ?? null)
        : null,
    ai_debug:
      message.role === 'assistant'
        ? (scoreByAssistantMessageId.get(message.id)?.debug ?? null)
        : null,
  }));
}

export async function getChatMessages(sessionId, clerkUserId) {
  const session = await getChatSession(sessionId, clerkUserId);
  if (!session) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .eq('clerk_user_id', clerkUserId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return hydrateMessagesWithAttachments(data ?? [], clerkUserId);
}

export async function appendChatExchange({ sessionId, clerkUserId, userMessage, assistantMessage, userAttachmentIds = [] }) {
  const supabase = getSupabaseAdmin();

  const { data: userRecord, error: userError } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      clerk_user_id: clerkUserId,
      role: 'user',
      content: userMessage,
    })
    .select('*')
    .single();

  if (userError) {
    throw userError;
  }

  await attachPendingFilesToMessage({
    attachmentIds: userAttachmentIds,
    messageId: userRecord.id,
    sessionId,
    clerkUserId,
  });

  const { data: assistantRecord, error: assistantError } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      clerk_user_id: clerkUserId,
      role: 'assistant',
      content: assistantMessage,
    })
    .select('*')
    .single();

  if (assistantError) {
    throw assistantError;
  }

  const session = await getChatSession(sessionId, clerkUserId);
  if (session && (!session.title || session.title === 'New session')) {
    const trimmedUserMessage = String(userMessage || '').trim();
    const titleSource = trimmedUserMessage || (userAttachmentIds.length ? 'Attachment' : 'New session');
    const title = titleSource.length > 40 ? `${titleSource.slice(0, 37)}...` : titleSource;

    const { error: sessionError } = await supabase
      .from('chat_sessions')
      .update({
        title: title || 'New session',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('clerk_user_id', clerkUserId)
      .is('deleted_at', null);

    if (sessionError) {
      throw sessionError;
    }
  }

  return hydrateMessagesWithAttachments([userRecord, assistantRecord], clerkUserId);
}

export async function getGlobalPersuasionPoints() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('persuasion_global_score')
    .select('total_points')
    .eq('singleton', true)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    if (isMissingChallengeSchemaError(error)) {
      return 0;
    }
    throw error;
  }

  return Number(data?.total_points || 0);
}

export async function getUserPersuasionPoints(clerkUserId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('persuasion_user_scores')
    .select('total_points')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    if (isMissingChallengeSchemaError(error)) {
      return 0;
    }
    throw error;
  }

  return Number(data?.total_points || 0);
}

export async function hasUserSubmissionHash({ clerkUserId, submissionHash }) {
  const safeHash = String(submissionHash || '').trim();
  if (!safeHash) {
    return false;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('persuasion_attempts')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .eq('submission_hash', safeHash)
    .limit(1)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    if (isMissingChallengeSchemaError(error)) {
      return false;
    }
    throw error;
  }

  return Boolean(data?.id);
}

export async function getLeaderboardSnapshot({ viewerUserId = null, limit = 100 } = {}) {
  const supabase = getSupabaseAdmin();
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));

  const [scoresResult, totalParticipantsResult, viewerScoreResult] = await Promise.all([
    supabase
      .from('persuasion_user_scores')
      .select('clerk_user_id, total_points, updated_at')
      .order('total_points', { ascending: false })
      .order('updated_at', { ascending: true })
      .limit(safeLimit),
    supabase.from('persuasion_user_scores').select('clerk_user_id', { count: 'exact', head: true }),
    viewerUserId
      ? supabase
          .from('persuasion_user_scores')
          .select('clerk_user_id, total_points, updated_at')
          .eq('clerk_user_id', viewerUserId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (scoresResult.error) {
    if (isMissingChallengeSchemaError(scoresResult.error)) {
      return {
        totalParticipants: 0,
        leaderboard: [],
        viewer: null,
      };
    }
    throw scoresResult.error;
  }

  if (totalParticipantsResult.error) {
    if (isMissingChallengeSchemaError(totalParticipantsResult.error)) {
      return {
        totalParticipants: 0,
        leaderboard: [],
        viewer: null,
      };
    }
    throw totalParticipantsResult.error;
  }

  if (viewerScoreResult.error && !isNoRowsError(viewerScoreResult.error)) {
    if (isMissingChallengeSchemaError(viewerScoreResult.error)) {
      return {
        totalParticipants: 0,
        leaderboard: [],
        viewer: null,
      };
    }
    throw viewerScoreResult.error;
  }

  const scoreRows = scoresResult.data ?? [];
  const profileIds = [...new Set(scoreRows.map((row) => row.clerk_user_id).filter(Boolean))];
  if (viewerUserId && viewerScoreResult.data?.clerk_user_id && !profileIds.includes(viewerUserId)) {
    profileIds.push(viewerUserId);
  }

  let profilesById = new Map();
  if (profileIds.length) {
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('clerk_user_id, first_name, last_name, email')
      .in('clerk_user_id', profileIds)
      .is('deleted_at', null);

    if (profileError) {
      if (isMissingChallengeSchemaError(profileError)) {
        return {
          totalParticipants: Number(totalParticipantsResult.count || 0),
          leaderboard: [],
          viewer: null,
        };
      }
      throw profileError;
    }

    profilesById = new Map((profileRows ?? []).map((row) => [row.clerk_user_id, row]));
  }

  const leaderboard = scoreRows.map((row, index) => ({
    rank: index + 1,
    clerkUserId: row.clerk_user_id,
    displayName: buildProfileDisplayName(profilesById.get(row.clerk_user_id)),
    email: profilesById.get(row.clerk_user_id)?.email || '',
    points: Number(row.total_points || 0),
    isCurrentUser: viewerUserId ? row.clerk_user_id === viewerUserId : false,
  }));

  let viewer = null;
  if (viewerUserId && viewerScoreResult.data?.clerk_user_id) {
    const viewerPoints = Number(viewerScoreResult.data.total_points || 0);
    let viewerRank = leaderboard.find((entry) => entry.clerkUserId === viewerUserId)?.rank ?? null;

    if (!viewerRank) {
      const { count: higherCount, error: rankError } = await supabase
        .from('persuasion_user_scores')
        .select('clerk_user_id', { count: 'exact', head: true })
        .gt('total_points', viewerPoints);

      if (rankError) {
        if (isMissingChallengeSchemaError(rankError)) {
          viewerRank = null;
        } else {
          throw rankError;
        }
      } else {
        viewerRank = Number(higherCount || 0) + 1;
      }
    }

    viewer = {
      rank: viewerRank,
      clerkUserId: viewerUserId,
      displayName: buildProfileDisplayName(profilesById.get(viewerUserId)),
      email: profilesById.get(viewerUserId)?.email || '',
      points: viewerPoints,
      isCurrentUser: true,
      inTopLeaderboard: leaderboard.some((entry) => entry.clerkUserId === viewerUserId),
    };
  }

  return {
    totalParticipants: Number(totalParticipantsResult.count || 0),
    leaderboard,
    viewer,
  };
}

export async function getPersuasionEvidenceMemory(limit = 80) {
  const supabase = getSupabaseAdmin();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 80));

  const { data, error } = await supabase
    .from('persuasion_attempts')
    .select('submission_hash, input_modality, awarded_points, evidence_preview, created_at')
    .eq('is_relevant', true)
    .gt('awarded_points', 0)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) {
    if (isMissingChallengeSchemaError(error)) {
      return 'none';
    }
    throw error;
  }

  const seen = new Set();
  const lines = [];

  for (const row of data ?? []) {
    const hash = String(row.submission_hash || '').trim();
    if (!hash || seen.has(hash)) {
      continue;
    }
    seen.add(hash);

    const preview = String(row.evidence_preview || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);

    const awarded = clampScore(row.awarded_points);
    lines.push(
      `${hash.slice(0, 12)}|${String(row.input_modality || 'none')}|${awarded}|${preview || 'no_preview'}`,
    );
  }

  return lines.length ? lines.join('\n') : 'none';
}

export async function recordPersuasionAttempt({
  clerkUserId,
  sessionId,
  userMessageId,
  assistantMessageId,
  submissionHash,
  inputModality,
  isRelevant,
  isDuplicate,
  modelRating,
  awardedPoints,
  evidencePreview = null,
  metadata = {},
}) {
  const supabase = getSupabaseAdmin();
  const safeModelRating = clampScore(modelRating);
  const safeAwardedPoints = clampScore(awardedPoints);
  const safeModality = String(inputModality || 'none').trim().toLowerCase() || 'none';
  const safeHash = String(submissionHash || '').trim();

  const { data, error } = await supabase.rpc('record_persuasion_attempt', {
    p_clerk_user_id: clerkUserId,
    p_session_id: sessionId,
    p_user_message_id: userMessageId,
    p_assistant_message_id: assistantMessageId,
    p_submission_hash: safeHash,
    p_input_modality: safeModality,
    p_is_relevant: Boolean(isRelevant),
    p_is_duplicate: Boolean(isDuplicate),
    p_model_rating: safeModelRating,
    p_awarded_points: safeAwardedPoints,
    p_evidence_preview: evidencePreview,
    p_metadata: metadata || {},
  });

  if (error) {
    if (isMissingChallengeSchemaError(error)) {
      return {
        attemptId: null,
        awardedPoints: 0,
        userTotalPoints: 0,
        globalTotalPoints: 0,
      };
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    attemptId: row?.attempt_id || null,
    awardedPoints: Number(row?.awarded_points ?? safeAwardedPoints),
    userTotalPoints: Number(row?.user_total_points ?? 0),
    globalTotalPoints: Number(row?.global_total_points ?? 0),
  };
}

export async function getChallengeLeaderboardSnapshot({ viewerUserId = null, limit = 20 } = {}) {
  const supabase = getSupabaseAdmin();
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));

  const [globalResult, participantCountResult, topScoresResult, viewerScoreResult] = await Promise.all([
    supabase
      .from('persuasion_global_score')
      .select('total_points, updated_at')
      .eq('singleton', true)
      .maybeSingle(),
    supabase.from('persuasion_user_scores').select('clerk_user_id', { count: 'exact', head: true }),
    supabase
      .from('persuasion_user_scores')
      .select('clerk_user_id, total_points, updated_at')
      .order('total_points', { ascending: false })
      .order('updated_at', { ascending: true })
      .limit(safeLimit),
    viewerUserId
      ? supabase
          .from('persuasion_user_scores')
          .select('clerk_user_id, total_points, updated_at')
          .eq('clerk_user_id', viewerUserId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (globalResult.error && !isNoRowsError(globalResult.error)) {
    if (isMissingChallengeSchemaError(globalResult.error)) {
      return buildEmptyChallengeSnapshot({ viewerUserId });
    }
    throw globalResult.error;
  }

  if (participantCountResult.error) {
    if (isMissingChallengeSchemaError(participantCountResult.error)) {
      return buildEmptyChallengeSnapshot({ viewerUserId });
    }
    throw participantCountResult.error;
  }

  if (topScoresResult.error) {
    if (isMissingChallengeSchemaError(topScoresResult.error)) {
      return buildEmptyChallengeSnapshot({ viewerUserId });
    }
    throw topScoresResult.error;
  }

  if (viewerScoreResult.error && !isNoRowsError(viewerScoreResult.error)) {
    if (isMissingChallengeSchemaError(viewerScoreResult.error)) {
      return buildEmptyChallengeSnapshot({ viewerUserId });
    }
    throw viewerScoreResult.error;
  }

  const globalPoints = Number(globalResult.data?.total_points || 0);
  const confidencePercent = calculateGlobalConfidencePercent(globalPoints);
  const participantCount = Number(participantCountResult.count || 0);

  const topScores = topScoresResult.data ?? [];
  const profileIds = [...new Set(topScores.map((row) => row.clerk_user_id).filter(Boolean))];
  const hasViewerOutsideTop =
    Boolean(viewerUserId) &&
    Boolean(viewerScoreResult.data?.clerk_user_id) &&
    !profileIds.includes(viewerUserId);
  if (hasViewerOutsideTop) {
    profileIds.push(viewerUserId);
  }

  let profilesById = new Map();
  if (profileIds.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('clerk_user_id, first_name, last_name, email')
      .in('clerk_user_id', profileIds)
      .is('deleted_at', null);

    if (profilesError) {
      if (isMissingChallengeSchemaError(profilesError)) {
        return buildEmptyChallengeSnapshot({ viewerUserId });
      }
      throw profilesError;
    }

    profilesById = new Map((profiles ?? []).map((profile) => [profile.clerk_user_id, profile]));
  }

  const leaderboard = topScores.map((row, index) => {
    const points = Number(row.total_points || 0);
    const contributionPercent = globalPoints > 0 ? Math.round((points / globalPoints) * 1000) / 10 : 0;

    return {
      rank: index + 1,
      clerkUserId: row.clerk_user_id,
      displayName: buildProfileDisplayName(profilesById.get(row.clerk_user_id)),
      email: profilesById.get(row.clerk_user_id)?.email || '',
      points,
      contributionPercent,
      isCurrentUser: viewerUserId ? row.clerk_user_id === viewerUserId : false,
    };
  });

  let viewerEntry = null;
  if (viewerUserId && viewerScoreResult.data?.clerk_user_id) {
    const viewerPoints = Number(viewerScoreResult.data.total_points || 0);
    let viewerRank = leaderboard.find((entry) => entry.clerkUserId === viewerUserId)?.rank ?? null;

    if (!viewerRank) {
      const { count: higherCount, error: higherCountError } = await supabase
        .from('persuasion_user_scores')
        .select('clerk_user_id', { count: 'exact', head: true })
        .gt('total_points', viewerPoints);

      if (higherCountError) {
        if (isMissingChallengeSchemaError(higherCountError)) {
          return buildEmptyChallengeSnapshot({ viewerUserId });
        }
        throw higherCountError;
      }

      viewerRank = Number(higherCount || 0) + 1;
    }

    const contributionPercent = globalPoints > 0 ? Math.round((viewerPoints / globalPoints) * 1000) / 10 : 0;

    viewerEntry = {
      rank: viewerRank,
      clerkUserId: viewerUserId,
      displayName: buildProfileDisplayName(profilesById.get(viewerUserId)),
      email: profilesById.get(viewerUserId)?.email || '',
      points: viewerPoints,
      contributionPercent,
      isCurrentUser: true,
      inTopLeaderboard: leaderboard.some((entry) => entry.clerkUserId === viewerUserId),
    };
  }

  return {
    globalPoints,
    globalConfidencePercent: confidencePercent,
    goalConfidencePercent: CHALLENGE_GOAL_CONFIDENCE_PERCENT,
    goalReached: confidencePercent >= CHALLENGE_GOAL_CONFIDENCE_PERCENT,
    participantCount,
    leaderboard,
    viewer: viewerEntry,
    updatedAt: globalResult.data?.updated_at || null,
  };
}

export async function getAdminUsers() {
  const supabase = getSupabaseAdmin();

  const [usersResult, sessionsResult, messagesResult, attachmentsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('chat_sessions').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('chat_messages').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('chat_message_attachments').select('id', { count: 'exact', head: true }).is('deleted_at', null),
  ]);

  if (usersResult.error) {
    throw usersResult.error;
  }

  if (sessionsResult.error) {
    throw sessionsResult.error;
  }

  if (messagesResult.error) {
    throw messagesResult.error;
  }

  if (attachmentsResult.error) {
    throw attachmentsResult.error;
  }

  const users = usersResult.data ?? [];
  const now = Date.now();
  const onlineUsers = users.filter((user) => {
    if (!user.last_seen_at) {
      return false;
    }

    return now - new Date(user.last_seen_at).getTime() <= ONLINE_WINDOW_MINUTES * 60 * 1000;
  }).length;

  return {
    users,
    stats: {
      totalUsers: users.length,
      verifiedUsers: users.filter((user) => user.is_verified).length,
      disabledUsers: users.filter((user) => user.is_disabled).length,
      adminUsers: users.filter((user) => user.is_admin).length,
      onlineUsers,
      totalChatSessions: sessionsResult.count ?? 0,
      totalMessages: messagesResult.count ?? 0,
      totalAttachments: attachmentsResult.count ?? 0,
    },
  };
}

export async function getAdminUserDetail(targetUserId) {
  const supabase = getSupabaseAdmin();

  const [profileResult, sessionsResult, messagesResult, attachmentsResult, authEventsResult, routeLogsResult, adminLogsResult] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('clerk_user_id', targetUserId)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('chat_sessions')
        .select('*')
        .eq('clerk_user_id', targetUserId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('chat_messages')
        .select('*')
        .eq('clerk_user_id', targetUserId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('chat_message_attachments')
        .select('*')
        .eq('clerk_user_id', targetUserId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('auth_events')
        .select('*')
        .eq('clerk_user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('route_access_logs')
        .select('*')
        .eq('clerk_user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('admin_audit_logs')
        .select('*')
        .eq('target_user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

  if (profileResult.error && !isNoRowsError(profileResult.error)) {
    throw profileResult.error;
  }

  if (sessionsResult.error) {
    throw sessionsResult.error;
  }

  if (messagesResult.error) {
    throw messagesResult.error;
  }

  if (attachmentsResult.error) {
    throw attachmentsResult.error;
  }

  if (authEventsResult.error) {
    throw authEventsResult.error;
  }

  if (routeLogsResult.error) {
    throw routeLogsResult.error;
  }

  if (adminLogsResult.error) {
    throw adminLogsResult.error;
  }

  return {
    profile: profileResult.data ?? null,
    sessions: sessionsResult.data ?? [],
    messages: messagesResult.data ?? [],
    attachments: attachmentsResult.data ?? [],
    authEvents: authEventsResult.data ?? [],
    routeLogs: routeLogsResult.data ?? [],
    adminLogs: adminLogsResult.data ?? [],
  };
}

export async function updateUserByAdmin({ actorUserId, targetUserId, updates }) {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_user_id', targetUserId)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingError && !isNoRowsError(existingError)) {
    throw existingError;
  }

  if (!existing) {
    return null;
  }

  const payload = {
    updated_at: new Date().toISOString(),
  };

  if (typeof updates.firstName === 'string') {
    payload.first_name = updates.firstName;
  }

  if (typeof updates.lastName === 'string') {
    payload.last_name = updates.lastName;
  }

  if (typeof updates.email === 'string') {
    payload.email = normalizeEmail(updates.email);
  }

  if (typeof updates.isVerified === 'boolean') {
    payload.is_verified = updates.isVerified;
    payload.verified_at = updates.isVerified ? new Date().toISOString() : null;
  }

  if (typeof updates.isAdmin === 'boolean') {
    payload.is_admin = updates.isAdmin;
  }

  if (typeof updates.isDisabled === 'boolean') {
    payload.is_disabled = updates.isDisabled;

    if (updates.isDisabled) {
      payload.disabled_at = new Date().toISOString();
      payload.disabled_reason = updates.disabledReason || 'Disabled by admin';
    } else {
      payload.disabled_at = null;
      payload.disabled_reason = null;
    }
  }

  if (typeof updates.disabledReason === 'string' && existing.is_disabled) {
    payload.disabled_reason = updates.disabledReason;
  }

  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update(payload)
    .eq('clerk_user_id', targetUserId)
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();

  if (updateError && !isNoRowsError(updateError)) {
    throw updateError;
  }

  if (!updated) {
    return null;
  }

  const { error: auditError } = await supabase.from('admin_audit_logs').insert({
    actor_user_id: actorUserId,
    target_user_id: targetUserId,
    action: 'profile_update',
    previous_data: existing,
    new_data: updated,
  });

  if (auditError) {
    throw auditError;
  }

  return updated;
}

export async function syncUserProfileFromClerk({ clerkUserId, firstName, lastName, email }) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('profiles')
    .update({
      first_name: firstName,
      last_name: lastName,
      email: normalizeEmail(email),
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_user_id', clerkUserId)
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return data ?? null;
}

export async function countInvalidRouteAttempts(clerkUserId) {
  const supabase = getSupabaseAdmin();

  const { count, error } = await supabase
    .from('route_access_logs')
    .select('id', { count: 'exact', head: true })
    .eq('clerk_user_id', clerkUserId)
    .eq('status', 'invalid_route');

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function hasRecentVerificationEmail(email) {
  const check = await canSendVerificationEmail(email);
  return !check.allowed;
}
