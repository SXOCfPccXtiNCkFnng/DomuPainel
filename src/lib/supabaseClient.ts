import { createClient } from '@supabase/supabase-js';
import { isProduction } from '@/lib/envSecrets';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (isProduction() && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórios em produção.'
  );
}

/**
 * Browser / anon client. RLS deny policies block data access via anon key;
 * prefer server APIs with service role for tenant data.
 */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
);
