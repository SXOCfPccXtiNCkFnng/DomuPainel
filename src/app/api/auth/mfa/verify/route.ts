import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import {
  applySessionCookie,
  clearMfaChallengeCookie,
  passwordFingerprint,
  readMfaChallenge,
} from '@/lib/requireAuth';
import { clientIpFromRequest } from '@/lib/rateLimit';
import { checkRateLimitDurable } from '@/lib/rateLimitDurable';
import { hasTwoFactorEnabled, verifySecondFactor } from '@/lib/twoFactor';
import { buildLoginUser } from '@/lib/loginResponse';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const EXPIRED = 'O tempo para digitar o código acabou. Entre com e-mail e senha de novo.';

/**
 * Segunda etapa do login: { code } do aplicativo autenticador ou
 * { recoveryCode }. Só funciona com o passe de 5 min que o login deixou
 * depois da senha certa.
 */
export async function POST(req: NextRequest) {
  try {
    const challenge = readMfaChallenge(req);
    if (!challenge) {
      const res = NextResponse.json({ success: false, error: EXPIRED, expired: true }, { status: 401 });
      clearMfaChallengeCookie(res);
      return res;
    }

    const ip = clientIpFromRequest(req);
    const [userLimit, ipLimit] = await Promise.all([
      checkRateLimitDurable(`mfa:uid:${challenge.uid}`, 5, 10 * 60 * 1000),
      checkRateLimitDurable(`mfa:ip:${ip}`, 20, 10 * 60 * 1000),
    ]);
    if (!userLimit.ok || !ipLimit.ok) {
      return NextResponse.json(
        { success: false, error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' },
        { status: 429, headers: { 'Retry-After': String(userLimit.retryAfterSec || ipLimit.retryAfterSec || 60) } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { code?: unknown; recoveryCode?: unknown };
    const code = typeof body.code === 'string' ? body.code : undefined;
    const recoveryCode = typeof body.recoveryCode === 'string' ? body.recoveryCode : undefined;
    if (!code && !recoveryCode) {
      return NextResponse.json({ success: false, error: 'Digite o código.' }, { status: 400 });
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('*, tenants(*)')
      .eq('id', challenge.uid)
      .maybeSingle();

    // Senha trocada, usuário removido ou duas etapas desligadas no meio do caminho: recomeça.
    if (
      !user ||
      user.tenant_id !== challenge.tid ||
      passwordFingerprint(String(user.password_hash || '')) !== challenge.pv ||
      !hasTwoFactorEnabled(user)
    ) {
      const res = NextResponse.json({ success: false, error: EXPIRED, expired: true }, { status: 401 });
      clearMfaChallengeCookie(res);
      return res;
    }

    const result = await verifySecondFactor(user.id, { code, recoveryCode });
    if (!result.ok) {
      logger.warn('auth.mfa_failed', { tenantId: user.tenant_id });
      return NextResponse.json(
        {
          success: false,
          error: recoveryCode
            ? 'Código de recuperação incorreto ou já usado.'
            : 'Código incorreto. Confira se o horário do celular está certo e tente de novo.',
        },
        { status: 401 }
      );
    }

    await supabaseAdmin.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
    if (result.method === 'recovery') {
      logger.info('auth.mfa_recovery_used', { tenantId: user.tenant_id, left: result.recoveryCodesLeft });
    }

    const res = NextResponse.json({
      success: true,
      user: await buildLoginUser(user),
      ...(result.method === 'recovery' ? { recoveryCodesLeft: result.recoveryCodesLeft } : {}),
    });
    applySessionCookie(
      res,
      { userId: user.id, tenantId: user.tenant_id, role: user.role || 'ADMIN', passwordHash: user.password_hash, mfa: true },
      challenge.rem
    );
    clearMfaChallengeCookie(res);
    return res;
  } catch (error: unknown) {
    logger.error('auth.mfa_verify_failed', { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Erro ao conferir o código. Tente de novo.' }, { status: 500 });
  }
}
