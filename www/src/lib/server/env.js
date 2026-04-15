import 'server-only';

import { z } from 'zod';

const smtpSecureSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const serverSchema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_ATTACHMENTS_BUCKET: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.coerce
    .number({ message: 'SMTP_PORT must be a valid port number' })
    .int()
    .min(1)
    .max(65535),
  SMTP_SECURE: smtpSecureSchema.optional(),
  SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),
  SMTP_FROM_EMAIL: z.string().email('SMTP_FROM_EMAIL must be a valid email address'),
  SMTP_FROM_NAME: z.string().min(1).optional(),
  APP_BASE_URL: z.string().url('APP_BASE_URL must be a valid URL'),
});

const parsedEnv = serverSchema.parse({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ATTACHMENTS_BUCKET: process.env.SUPABASE_ATTACHMENTS_BUCKET,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME,
  APP_BASE_URL: process.env.APP_BASE_URL,
});

export const env = {
  ...parsedEnv,
  SMTP_SECURE: parsedEnv.SMTP_SECURE ?? parsedEnv.SMTP_PORT === 465,
};

export const APP_BASE_URL = env.APP_BASE_URL.replace(/\/$/, '');
