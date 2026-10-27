/**
 * Verificação em duas etapas do login próprio (aplicativo autenticador).
 * O segredo fica criptografado no banco; códigos de recuperação, só o hash.
 */
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { decryptData, encryptData } from '@/lib/crypto';
import { getSessionSecret } from '@/lib/envSecrets';
import { generateRecoveryCodes, normalizeRecoveryCode, verifyTotp } from '@/lib/totp';

export const TWO_FACTOR_MIGRATION_PENDING =
  'A verificação em duas etapas ainda não foi ativada no banco (migration 20261027_two_factor.sql).';

const COLUMNS = 'totp_secret_enc, totp_secret_iv, totp_enabled_at, totp_last_step, totp_recovery_hashes';

type TwoFactorRow = {
  totp_secret_enc: string | null;
  totp_secret_iv: string | null;
  totp_enabled_at: string | null;
  totp_last_step: number | string | null;
  totp_recovery_hashes: string[] | null;
};

export function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204';
}

/** Hash do código de recuperação (HMAC com o segredo do servidor: não dá para adivinhar pelo banco). */
export function hashRecoveryCode(code: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(`rc:${normalizeRecoveryCode(code)}`).digest('hex');
}

export function encryptSecret(secret: string): { enc: string; iv: string } {
  const { encryptedText, iv } = encryptData(secret);
  return { enc: encryptedText, iv };
}

export function decryptSecret(enc: string | null, iv: string | null): string | null {
  if (!enc || !iv) return null;
  try {
    return decryptData(enc, iv);
  } catch {
    return null;
  }
}

export type TwoFactorState = {
  /** false também quando a migration não rodou (login segue só com senha). */
  available: boolean;
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesLeft: number;
};

export async function loadTwoFactorState(userId: string): Promise<TwoFactorState> {
  const { data, error } = await supabaseAdmin.from('users').select(COLUMNS).eq('id', userId).maybeSingle();
  if (isMissingColumn(error)) return { available: false, enabled: false, enabledAt: null, recoveryCodesLeft: 0 };
  if (error) throw error;
  const row = data as TwoFactorRow | null;
  return {
    available: true,
    enabled: Boolean(row?.totp_enabled_at && row.totp_secret_enc),
    enabledAt: row?.totp_enabled_at ?? null,
    recoveryCodesLeft: row?.totp_recovery_hashes?.length ?? 0,
  };
}

/** Quem tem as duas etapas ligadas (usado no login, logo depois da senha). */
export function hasTwoFactorEnabled(user: Record<string, unknown>): boolean {
  return Boolean(user.totp_enabled_at && user.totp_secret_enc);
}

/**
 * Confere o código do aplicativo ou um código de recuperação. O código do
 * aplicativo só vale uma vez (grava o passo usado); o de recuperação é gasto.
 */
export async function verifySecondFactor(
  userId: string,
  input: { code?: string; recoveryCode?: string }
): Promise<{ ok: true; method: 'totp' | 'recovery'; recoveryCodesLeft: number } | { ok: false }> {
  const { data, error } = await supabaseAdmin.from('users').select(COLUMNS).eq('id', userId).maybeSingle();
  if (error || !data) return { ok: false };
  const row = data as TwoFactorRow;
  if (!row.totp_enabled_at) return { ok: false };
  const hashes = row.totp_recovery_hashes || [];

  if (input.recoveryCode) {
    const hash = hashRecoveryCode(input.recoveryCode);
    if (!hashes.includes(hash)) return { ok: false };
    const remaining = hashes.filter((h) => h !== hash);
    // Só gasta se ainda estiver lá (duas abas usando o mesmo código: só uma passa).
    const { data: updated } = await supabaseAdmin
      .from('users')
      .update({ totp_recovery_hashes: remaining })
      .eq('id', userId)
      .contains('totp_recovery_hashes', [hash])
      .select('id');
    if (!updated?.length) return { ok: false };
    return { ok: true, method: 'recovery', recoveryCodesLeft: remaining.length };
  }

  const secret = decryptSecret(row.totp_secret_enc, row.totp_secret_iv);
  if (!secret) return { ok: false };
  const lastStep = row.totp_last_step == null ? null : Number(row.totp_last_step);
  const step = verifyTotp(secret, input.code || '', { lastStep });
  if (step == null) return { ok: false };
  const { data: updated } = await supabaseAdmin
    .from('users')
    .update({ totp_last_step: step })
    .eq('id', userId)
    .or(`totp_last_step.is.null,totp_last_step.lt.${step}`)
    .select('id');
  if (!updated?.length) return { ok: false };
  return { ok: true, method: 'totp', recoveryCodesLeft: hashes.length };
}

/** Novos códigos de recuperação: devolve os códigos (mostrados uma vez) e grava só os hashes. */
export function newRecoveryCodes(): { codes: string[]; hashes: string[] } {
  const codes = generateRecoveryCodes();
  return { codes, hashes: codes.map(hashRecoveryCode) };
}
