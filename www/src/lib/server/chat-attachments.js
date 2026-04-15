import 'server-only';

import { randomUUID } from 'node:crypto';

import { env } from '@/lib/server/env';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

const DEFAULT_ATTACHMENTS_BUCKET = 'chat-attachments';
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_VIDEO_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 30;

const IMAGE_SIGNATURES = [
  {
    mimeType: 'image/png',
    extension: 'png',
    matches: (bytes) =>
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  {
    mimeType: 'image/jpeg',
    extension: 'jpg',
    matches: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  {
    mimeType: 'image/gif',
    extension: 'gif',
    matches: (bytes) =>
      bytes.length >= 6 &&
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38 &&
      (bytes[4] === 0x39 || bytes[4] === 0x37) &&
      bytes[5] === 0x61,
  },
  {
    mimeType: 'image/webp',
    extension: 'webp',
    matches: (bytes) => bytes.length >= 12 && readAscii(bytes, 0, 4) === 'RIFF' && readAscii(bytes, 8, 12) === 'WEBP',
  },
];

function getAttachmentsBucketName() {
  return env.SUPABASE_ATTACHMENTS_BUCKET || DEFAULT_ATTACHMENTS_BUCKET;
}

function readAscii(bytes, start, end) {
  return String.fromCharCode(...bytes.slice(start, end));
}

function readUint32BE(bytes, offset) {
  if (offset + 4 > bytes.length) {
    return null;
  }

  return (bytes[offset] * 2 ** 24) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function readUint64BEAsNumber(bytes, offset) {
  if (offset + 8 > bytes.length) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const value = view.getBigUint64(offset, false);
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);

  if (value > maxSafe) {
    return null;
  }

  return Number(value);
}

function isLikelyMp4(bytes) {
  if (bytes.length < 12) {
    return false;
  }

  return readAscii(bytes, 4, 8) === 'ftyp';
}

function parseMp4MvhdDurationSeconds(bytes) {
  const containerBoxes = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'udta']);

  function scan(offset, end) {
    let cursor = offset;

    while (cursor + 8 <= end) {
      const size32 = readUint32BE(bytes, cursor);
      const type = readAscii(bytes, cursor + 4, cursor + 8);
      if (!size32 || size32 < 8) {
        return null;
      }

      let headerSize = 8;
      let boxSize = size32;

      if (size32 === 1) {
        const size64 = readUint64BEAsNumber(bytes, cursor + 8);
        if (!size64 || size64 < 16) {
          return null;
        }

        boxSize = size64;
        headerSize = 16;
      } else if (size32 === 0) {
        boxSize = end - cursor;
      }

      const boxEnd = cursor + boxSize;
      if (boxEnd > end || boxEnd > bytes.length) {
        return null;
      }

      if (type === 'mvhd') {
        const version = bytes[cursor + headerSize];
        const contentStart = cursor + headerSize;

        if (version === 0) {
          const timescale = readUint32BE(bytes, contentStart + 12);
          const duration = readUint32BE(bytes, contentStart + 16);
          if (!timescale || duration === null) {
            return null;
          }

          return duration / timescale;
        }

        if (version === 1) {
          const timescale = readUint32BE(bytes, contentStart + 20);
          const duration = readUint64BEAsNumber(bytes, contentStart + 24);
          if (!timescale || duration === null) {
            return null;
          }

          return duration / timescale;
        }
      }

      if (type === 'meta') {
        const nestedStart = cursor + headerSize + 4;
        if (nestedStart < boxEnd) {
          const nestedDuration = scan(nestedStart, boxEnd);
          if (nestedDuration !== null) {
            return nestedDuration;
          }
        }
      } else if (containerBoxes.has(type)) {
        const nestedStart = cursor + headerSize;
        if (nestedStart < boxEnd) {
          const nestedDuration = scan(nestedStart, boxEnd);
          if (nestedDuration !== null) {
            return nestedDuration;
          }
        }
      }

      cursor = boxEnd;
    }

    return null;
  }

  return scan(0, bytes.length);
}

function detectAttachmentType(bytes) {
  for (const signature of IMAGE_SIGNATURES) {
    if (signature.matches(bytes)) {
      return {
        kind: 'image',
        mimeType: signature.mimeType,
        extension: signature.extension,
      };
    }
  }

  if (isLikelyMp4(bytes)) {
    return {
      kind: 'video',
      mimeType: 'video/mp4',
      extension: 'mp4',
    };
  }

  return null;
}

export function sanitizeAttachmentFileName(fileName, fallbackExtension = 'bin') {
  const original = String(fileName || '').trim() || `upload.${fallbackExtension}`;
  const normalized = original.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-{2,}/g, '-');
  return normalized.slice(0, 120) || `upload.${fallbackExtension}`;
}

export async function validateAndNormalizeAttachment(file) {
  if (!(file instanceof File)) {
    throw new Error('Invalid attachment payload');
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error('Attachment is empty');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectAttachmentType(bytes);
  if (!detected) {
    throw new Error('Only PNG, JPEG, GIF, WEBP images and MP4 videos are allowed');
  }

  const declaredType = String(file.type || '').toLowerCase();
  if (!declaredType || declaredType !== detected.mimeType) {
    throw new Error('Attachment MIME type does not match the file contents');
  }

  if (detected.kind === 'image') {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error('Image attachments must be smaller than 3MB');
    }

    return {
      kind: detected.kind,
      mimeType: detected.mimeType,
      extension: detected.extension,
      byteSize: file.size,
      durationSeconds: null,
      buffer: bytes,
    };
  }

  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('Video attachments must be smaller than 8MB');
  }

  const durationSeconds = parseMp4MvhdDurationSeconds(bytes);
  if (durationSeconds === null) {
    throw new Error('Could not read MP4 duration metadata');
  }

  if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
    throw new Error('Video attachments must be 30 seconds or shorter');
  }

  return {
    kind: detected.kind,
    mimeType: detected.mimeType,
    extension: detected.extension,
    byteSize: file.size,
    durationSeconds: Number(durationSeconds.toFixed(3)),
    buffer: bytes,
  };
}

export async function uploadAttachmentToSupabaseStorage({
  fileName,
  mimeType,
  data,
  clerkUserId,
  sessionId,
}) {
  const supabase = getSupabaseAdmin();
  const bucketName = getAttachmentsBucketName();
  const safeFileName = sanitizeAttachmentFileName(fileName);
  const storagePath = `${clerkUserId}/${sessionId}/${Date.now()}-${randomUUID()}-${safeFileName}`;

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, Buffer.from(data), {
      contentType: mimeType,
      upsert: false,
      cacheControl: '3600',
    });

  if (error) {
    throw new Error(error.message || 'Failed to upload attachment to Supabase Storage');
  }

  const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);

  return {
    bucketName,
    storagePath,
    publicUrl: publicUrlData?.publicUrl || '',
    safeFileName,
  };
}

export async function deleteAttachmentFromSupabaseStorage({ bucketName, storagePath }) {
  if (!bucketName || !storagePath) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucketName).remove([storagePath]);

  if (error) {
    throw new Error(error.message || 'Failed to delete attachment from Supabase Storage');
  }
}
