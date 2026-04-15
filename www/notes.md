# Make `hello@hirusha.xyz` an admin

The app checks admin access from `public.profiles.is_admin`.

## Option 1 (recommended): Supabase SQL Editor

1. Open your Supabase project.
2. Go to `SQL Editor`.
3. Run this to confirm the user row exists:

```sql
select clerk_user_id, email, is_admin, is_verified, is_disabled
from public.profiles
where email = 'hello@hirusha.xyz';
```

4. Run this to promote the user:

```sql
update public.profiles
set
  is_admin = true,
  updated_at = timezone('utc', now())
where email = 'hello@hirusha.xyz';
```

5. Verify:

```sql
select clerk_user_id, email, is_admin
from public.profiles
where email = 'hello@hirusha.xyz';
```

## If no row is returned

Have the user register/log in once so the profile is created, then run the update again.

---

# Reset Supabase and start over

## Option 1 (safest): create a new Supabase project

1. In Supabase dashboard, create a new project.
2. Copy new keys/URL into `.env.local`.
3. Run `supabase/schema.sql` in the new project SQL Editor.

This guarantees a clean reset with no leftover data/files.

## Option 2: wipe current project data in place

First, remove attachment files from Storage (SQL cannot directly delete from `storage.objects` in Supabase):

1. Open `Storage` in Supabase dashboard.
2. Open bucket `chat-attachments`.
3. Delete all objects (or delete/recreate the bucket).

Then run this in SQL Editor to wipe app tables:

```sql
begin;

truncate table
  public.admin_audit_logs,
  public.route_access_logs,
  public.auth_events,
  public.chat_message_attachments,
  public.chat_messages,
  public.chat_sessions,
  public.password_reset_email_events,
  public.password_reset_tokens,
  public.verification_email_events,
  public.email_verification_tokens,
  public.profiles
restart identity cascade;

commit;
```

After that:

1. Re-run `supabase/schema.sql` (safe/idempotent).
2. Re-create your first admin after a user signs up (use the SQL above in this file).

Optional full reset note:
- If you also want auth users fully reset, delete users from Clerk dashboard as well (Supabase reset does not remove Clerk users).
