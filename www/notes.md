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
