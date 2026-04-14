# ICONIP 2026 CTF Demo (`www`)

This is a Next.js 16 (App Router) project with:

- Authentication: Clerk
- Data + logs: Supabase
- Verification email delivery: Resend
- UI: TailwindCSS + DaisyUI + react-toastify

## Implemented routes

- `/` home with title and redirect to `/chat` when logged in
- `/login` email/password login with verified-only check and resend verification flow
- `/register` first/last/email/password/password-confirm and "Check your inbox" state
- `/logout` protected signout
- `/chat` protected chat with sessions, switching, ending sessions, and persisted messages
- `/admin/*` protected admin routes (requires `is_admin`)
- `/admin/users` -> `/admin/users/all`
- `/admin/users/all` user table + stats
- `/admin/users/[userId]` user details, chat history, auth/route logs, and admin controls
- `/404` custom not-found page
- invalid routes are redirected to `/404` via `src/proxy.js`

## Setup

1. Install dependencies (you said you'll run this manually):

```bash
npm install
npm install @clerk/nextjs @supabase/supabase-js react-toastify resend zod
```

2. Create `.env.local` from `.env.example` and fill values.

3. Run SQL schema in Supabase:

- Open Supabase SQL Editor
- Run [`supabase/schema.sql`](./supabase/schema.sql)

4. Start dev server:

```bash
npm run dev
```

## Notes

- Server-only backend logic is in `src/lib/server/*` and is not shipped to the client.
- Verification resend is rate-limited to one request per 5 minutes per email.
- No hard-delete path is implemented; records use soft-delete columns where relevant.
