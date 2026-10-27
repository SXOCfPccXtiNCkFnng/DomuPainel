import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';
import { verifyPassword } from '@/lib/authHelpers';
import { checkRateLimitDurable } from '@/lib/rateLimitDurable';
import { formatSecretForDisplay, generateTotpSecret, otpauthUrl, verifyTotp } from '@/lib/totp';
import {
  decryptSecret,
  encryptSecret,
  isMissingColumn,
  loadTwoFactorState,
  newRecoveryCodes,
  TWO_FACTOR_MIGRATION_PENDING,
  verifySecondFactor,
} from '@/lib/twoFactor';
import { internalErrorResponse } from '@/lib/errors';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const ISSUER = 'Domu Tech';

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

/** Estado da verificação em duas etapas de quem está logado. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    return NextResponse.json({ success: true, ...(await loadTwoFactorState(auth.session.userId)) });
  } catch (error: unknown) {
    return internalErrorResponse('api.auth.mfa.get', error);
  }
}

/**
 * Ligar e desligar as duas etapas da própria conta:
 * - { action: 'start' } → QR code e chave para o aplicativo (ainda não liga);
 * - { action: 'confirm', code } → confere o 1º código, liga e devolve os códigos de recuperação;
 * - { action: 'regenerate', code } → novos códigos de recuperação (os antigos deixam de valer);
 * - { action: 'disable', password, code | recoveryCode } → desliga.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const userId = auth.session.userId;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || '');

    const limit = await checkRateLimitDurable(`mfa:settings:${userId}`, 10, 10 * 60 * 1000);
    if (!limit.ok) return bad('Muitas tentativas. Aguarde alguns minutos e tente de novo.', 429);

    const state = await loadTwoFactorState(userId);
    if (!state.available) return bad(TWO_FACTOR_MIGRATION_PENDING, 503);

    if (action === 'start') {
      if (state.enabled) return bad('A verificação em duas etapas já está ligada.');
      const { data: user } = await supabaseAdmin.from('users').select('email').eq('id', userId).maybeSingle();
      const secret = generateTotpSecret();
      const { enc, iv } = encryptSecret(secret);
      const { error } = await supabaseAdmin
        .from('users')
        .update({ totp_pending_enc: enc, totp_pending_iv: iv })
        .eq('id', userId);
      if (error) {
        if (isMissingColumn(error)) return bad(TWO_FACTOR_MIGRATION_PENDING, 503);
        throw error;
      }
      const url = otpauthUrl({ issuer: ISSUER, account: user?.email || 'conta', secret });
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: 'M' });
      return NextResponse.json({ success: true, qr, secret: formatSecretForDisplay(secret), otpauthUrl: url });
    }

    if (action === 'confirm') {
      if (state.enabled) return bad('A verificação em duas etapas já está ligada.');
      const { data: row } = await supabaseAdmin
        .from('users')
        .select('totp_pending_enc, totp_pending_iv')
        .eq('id', userId)
        .maybeSingle();
      const secret = decryptSecret(row?.totp_pending_enc ?? null, row?.totp_pending_iv ?? null);
      if (!secret) return bad('Comece de novo: clique em ativar para gerar um novo QR code.');
      const step = verifyTotp(secret, String(body.code || ''));
      if (step == null) return bad('Código incorreto. Confira se o horário do celular está certo e tente de novo.');

      const recovery = newRecoveryCodes();
      const { error } = await supabaseAdmin
        .from('users')
        .update({
          totp_secret_enc: row!.totp_pending_enc,
          totp_secret_iv: row!.totp_pending_iv,
          totp_enabled_at: new Date().toISOString(),
          totp_last_step: step,
          totp_pending_enc: null,
          totp_pending_iv: null,
          totp_recovery_hashes: recovery.hashes,
        })
        .eq('id', userId);
      if (error) throw error;
      logger.info('auth.mfa_enabled', { tenantId: auth.session.tenantId });
      return NextResponse.json({ success: true, recoveryCodes: recovery.codes });
    }

    if (action === 'regenerate') {
      if (!state.enabled) return bad('A verificação em duas etapas está desligada.');
      const check = await verifySecondFactor(userId, { code: String(body.code || '') });
      if (!check.ok) return bad('Código incorreto.');
      const recovery = newRecoveryCodes();
      const { error } = await supabaseAdmin.from('users').update({ totp_recovery_hashes: recovery.hashes }).eq('id', userId);
      if (error) throw error;
      return NextResponse.json({ success: true, recoveryCodes: recovery.codes });
    }

    if (action === 'disable') {
      if (!state.enabled) return bad('A verificação em duas etapas já está desligada.');
      const { data: user } = await supabaseAdmin.from('users').select('password_hash').eq('id', userId).maybeSingle();
      const password = await verifyPassword(String(body.password || ''), String(user?.password_hash || ''));
      if (!password.ok) return bad('Senha incorreta.');
      const check = await verifySecondFactor(userId, {
        code: typeof body.code === 'string' ? body.code : undefined,
        recoveryCode: typeof body.recoveryCode === 'string' ? body.recoveryCode : undefined,
      });
      if (!check.ok) return bad('Código incorreto.');
      const { error } = await supabaseAdmin
        .from('users')
        .update({
          totp_secret_enc: null,
          totp_secret_iv: null,
          totp_enabled_at: null,
          totp_pending_enc: null,
          totp_pending_iv: null,
          totp_last_step: null,
          totp_recovery_hashes: [],
        })
        .eq('id', userId);
      if (error) throw error;
      logger.info('auth.mfa_disabled', { tenantId: auth.session.tenantId });
      return NextResponse.json({ success: true });
    }

    return bad('Ação inválida.');
  } catch (error: unknown) {
    return internalErrorResponse('api.auth.mfa.post', error);
  }
}
