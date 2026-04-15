import 'server-only';

import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
const ONLINE_WINDOW_MINUTES = 5;
const ONE_HOUR_IN_MS = 60 * 60 * 1000;
const ATTACHMENT_HOURLY_LIMIT = 3;

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

  return messages.map((message) => ({
    ...message,
    attachments: attachmentsByMessageId.get(message.id) ?? [],
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

export async function getAdminUsers() {
  const supabase = getSupabaseAdmin();

  const [usersResult, sessionsResult, messagesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('chat_sessions').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('chat_messages').select('id', { count: 'exact', head: true }).is('deleted_at', null),
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
    },
  };
}

export async function getAdminUserDetail(targetUserId) {
  const supabase = getSupabaseAdmin();

  const [profileResult, sessionsResult, messagesResult, authEventsResult, routeLogsResult, adminLogsResult] =
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
        .order('created_at', { ascending: false })
        .limit(300),
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
