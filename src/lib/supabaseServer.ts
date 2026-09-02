import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '@/lib/envSecrets';

const { url: supabaseUrl, serviceRoleKey: supabaseServiceRoleKey } = getSupabaseConfig();

/**
 * Server-only Admin Supabase Client.
 * Uses the Service Role Key to bypass RLS for backend tasks.
 * Anon/authenticated PostgREST are denied by RLS policies (see schema).
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
