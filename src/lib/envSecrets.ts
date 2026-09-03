/** Helpers para secrets — sem fallbacks inseguros em produção */

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getSessionSecret(): string {
  const secret = process.env.DOMU_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret && secret.length >= 32) return secret;

  if (isProduction()) {
    throw new Error(
      'DOMU_SESSION_SECRET (mín. 32 chars) é obrigatório em produção.'
    );
  }

  if (secret && secret.length >= 16) return secret;
  return 'domu_dev_session_secret_change_me_2026';
}

export function getEncryptionSecret(): string {
  const key = process.env.ENCRYPTION_SECRET_KEY;
  if (key && key.length >= 32) return key;

  if (isProduction()) {
    throw new Error(
      'ENCRYPTION_SECRET_KEY (mín. 32 chars) é obrigatório em produção.'
    );
  }

  if (key && key.length >= 16) return key;
  return 'domu_tech_master_encryption_key_32bytes_secret!';
}

export function getSupabaseConfig(): { url: string; serviceRoleKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceRoleKey && !serviceRoleKey.includes('placeholder')) {
    return { url, serviceRoleKey };
  }

  if (isProduction()) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios em produção.'
    );
  }

  // Fallback only for local/build without env
  return {
    url: url || 'https://domutech.supabase.co',
    serviceRoleKey: serviceRoleKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
  };
}

/** App Secret da Meta para validar X-Hub-Signature-256 do webhook. */
export function getMetaAppSecret(): string | null {
  const secret = process.env.META_APP_SECRET;
  if (secret && secret.length >= 8) return secret;
  return secret || null;
}

export function getMetaVerifyToken(): string | null {
  const token = process.env.META_VERIFY_TOKEN;
  if (token && token.length >= 8) return token;
  return token || null;
}
