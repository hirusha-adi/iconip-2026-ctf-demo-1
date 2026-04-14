import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { env } from '@/lib/server/env';

let supabaseAdmin;

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    });
  }

  return supabaseAdmin;
}
