# System Architecture (ICONIP 2026 CTF Demo)

## 1) Purpose
This project is a full-stack Next.js app for:
- Account onboarding and security (email verification, password reset, MFA)
- User chat sessions with an AI assistant
- Image/video attachments in chat
- Admin user management and auditing

The app is intentionally server-centric: sensitive operations run in Next.js server routes/actions with service credentials.

## 2) Tech Stack
- Frontend + backend framework: `Next.js 16` (App Router, route handlers, server components/actions)
- UI: `React 19`, `Tailwind`, `daisyui`, `react-toastify`
- Auth/identity: `Clerk`
- Primary datastore: `Supabase Postgres` (service-role access from server)
- File storage: `Supabase Storage` bucket `chat-attachments`
- AI inference: `OpenAI` via `openai` SDK, model `gpt-5-nano`
- Email delivery: `Nodemailer` via SMTP
- Validation: `zod`

## 3) High-Level Component Graph
1. Browser UI (App Router pages + client components)
2. Next.js server layer
   - API routes under `src/app/api/**`
   - Server utilities under `src/lib/server/**`
   - Server actions in admin detail page
3. External services
   - Clerk (users, sessions, MFA)
   - Supabase Postgres + Storage
   - OpenAI Responses API
   - SMTP provider

Trust boundaries:
- Client is untrusted.
- Next.js server is trusted and holds privileged keys.
- Supabase is accessed using service role key from server only.

## 4) Runtime Structure

### 4.1 App Shell
- Root layout: `src/app/layout.js`
  - Wraps app in `ClerkProvider`
  - Maps Clerk task key `setup-mfa` to route `/setup-mfa`
  - Mounts global toast provider

### 4.2 Routing Guard / Invalid Route Logging
- `src/proxy.js`:
  - Validates path against allow-list + patterns (`src/lib/shared/routes.js`)
  - Invalid paths are logged to `route_access_logs` with `status=invalid_route`
  - User redirected to `/404`

### 4.3 AuthZ Layer
- `src/lib/server/authz.js`
  - `requirePageUser()` enforces signed-in + verified + not disabled
  - `requirePageAdmin()` enforces `is_admin=true`
  - Updates `last_seen_at` on successful page gating

## 5) Core Domain Model (Supabase)
Schema file: `supabase/schema.sql`

Main tables:
- `profiles`: canonical app user profile keyed by `clerk_user_id`
- `email_verification_tokens`, `verification_email_events`
- `password_reset_tokens`, `password_reset_email_events`
- `chat_sessions`, `chat_messages`
- `chat_message_attachments`
- `auth_events`, `route_access_logs`, `admin_audit_logs`

Key constraints/policies:
- Attachment DB-level checks:
  - image <= `3MB`
  - video <= `8MB` and duration <= `30s`
- Most domain tables include soft-delete column `deleted_at`
- `profiles` and `chat_sessions` have `updated_at` triggers
- RLS is enabled, and app accesses DB with service role from server
- Storage bucket `chat-attachments` configured public with MIME allow-list

## 6) Main Flows

### 6.1 Registration + Email Verification
Routes:
- `POST /api/auth/register`
- `GET /api/auth/verify-email?token=...`
- `POST /api/auth/resend-verification`

Flow:
1. Validate payload (`zod`)
2. Create Clerk user
3. Upsert profile in Supabase
4. Rate-limit verification emails (1 per 5 minutes)
5. Create hashed verification token (token raw never stored)
6. Send verification email with signed link
7. On verification, consume token, mark `profiles.is_verified=true`, log auth event

### 6.2 Login + MFA
Routes/UI:
- `POST /api/auth/prelogin` (app-level blocks for unverified/disabled)
- Client login via Clerk in `src/components/LoginForm.js`
- `POST /api/auth/login-audit`

Flow:
1. Prelogin checks Supabase profile state
2. Clerk password sign-in attempt
3. If second factor required, user picks strategy:
   - TOTP (`totp`)
   - Backup code (`backup_code`)
   - Email code (`email_code`)
4. On completion, session finalized and login audit logged

### 6.3 MFA Setup (/setup-mfa)
UI component: `src/components/SetupMfaClient.js`

Flow:
1. `user.createTOTP()` to initialize secret/URI
2. User verifies TOTP code via `user.verifyTOTP()`
3. Backup codes generated via `user.createBackupCode()`
4. User can regenerate backup codes or disable/start over (`user.disableTOTP()`)

### 6.4 Forgot/Reset Password
Routes:
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Flow:
1. Forgot-password always returns generic success message (anti-enumeration)
2. If account exists and rate-limit allows: create hashed reset token (1h expiry)
3. Send reset link via SMTP
4. Reset endpoint consumes token once, updates Clerk password, logs auth event

### 6.5 Chat Sessions + AI Reply
Routes:
- `GET/POST /api/chat/sessions`
- `GET/PATCH/PUT /api/chat/sessions/[sessionId]`
- `POST /api/chat/messages`

Flow:
1. New session created in DB
2. First assistant message is seeded:
   - `"Hello {firstName}, did you know that water is solid at room temperature?"`
3. Message send pipeline:
   - Validate payload (`zod`)
   - Verify session ownership and active state
   - Load message history + attached file metadata context
   - Generate assistant response with OpenAI (`gpt-5-nano`)
   - Persist user + assistant messages atomically at app level
4. Session title auto-updates from first user content/attachment

### 6.6 Attachments
Routes:
- `POST /api/chat/attachments`
- `DELETE /api/chat/attachments/[attachmentId]`

Validation/storage pipeline:
1. Requires active, owned session
2. User upload quota: max `3` attachments per hour across all sessions
3. Binary signature validation (not extension-only):
   - PNG/JPEG/GIF/WEBP images
   - MP4 videos only
4. MP4 duration parsed from container metadata (`mvhd`)
5. Upload to Supabase Storage, then persist metadata row in `chat_message_attachments`
6. Attachments are initially pending (`message_id=null`) and later linked on message send
7. Pending attachment delete removes storage object + soft-deletes DB row

### 6.7 Admin Operations
Pages:
- `/admin/users/all`
- `/admin/users/[userId]`

Capabilities:
- View users, sessions, messages, attachments, auth events, route logs, admin audit logs
- Mutate user profile fields and flags (verify/admin/disable) via server actions
- Mirror key changes to Clerk where needed (`safeUpdateClerkUser`, `safeSetDisabledState`)
- All admin profile mutations create `admin_audit_logs` entries

## 7) AI Subsystem
File: `src/lib/server/ai.js`

- System prompt loaded from `MASTER_PROMPT.md` (cached)
- Input history includes user/assistant text
- Attachment context is textual metadata (filename/type/duration), not binary multimodal upload
- Uses OpenAI Responses API via SDK
- Empty model outputs are treated as errors

## 8) Email Subsystem
File: `src/lib/server/email.js`

- SMTP transport initialized lazily via Nodemailer
- Sends:
  - Verification email
  - Password reset email
- Logs send attempts/results/failures to server console

## 9) Validation and Security Controls
- Input validation with `zod` in `src/lib/shared/validation.js`
- Token security:
  - Random token generation
  - SHA-256 hash stored, raw token only sent via email link
- Account state enforcement:
  - `is_verified` and `is_disabled` checked before protected access
- Rate limits:
  - Verification emails: 1 / 5 min per email
  - Reset emails: 1 / 5 min per email
  - Attachments: 3 / hour per user
- Auditability:
  - `auth_events`, `route_access_logs`, `admin_audit_logs`

## 10) Configuration / Secrets
From `.env` (`src/lib/server/env.js`):
- App: `APP_BASE_URL`
- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ATTACHMENTS_BUCKET`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`
- OpenAI: `OPENAI_API_KEY`

Important:
- `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, SMTP creds, and `OPENAI_API_KEY` must stay server-only.

## 11) Key Source Files (Fast Orientation)
- Auth/business core: `src/lib/server/db.js`
- AI integration: `src/lib/server/ai.js`
- Attachment validation/storage: `src/lib/server/chat-attachments.js`
- AuthZ guards: `src/lib/server/authz.js`
- Email transport: `src/lib/server/email.js`
- DB schema: `supabase/schema.sql`
- Chat API: `src/app/api/chat/**`
- Auth API: `src/app/api/auth/**`
- User/Admin pages: `src/app/user/page.js`, `src/app/admin/**`

## 12) Known Design Decisions
- Soft-delete oriented schema, but storage object deletion is explicit when removing pending attachments.
- Supabase is used as app database and attachment storage; Clerk remains source of truth for identity/session/MFA primitives.
- Server performs almost all privileged operations; client focuses on orchestration and UI state.
