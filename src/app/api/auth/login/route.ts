import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { hashPassword, verifyPassword } from '@/lib/authHelpers';
import { applyMfaChallengeCookie, applySessionCookie, clearMfaChallengeCookie } from '@/lib/requireAuth';
import { clientIpFromRequest } from '@/lib/rateLimit';
import { checkRateLimitDurable } from '@/lib/rateLimitDurable';
import { CAPTCHA_ERROR, verifyCaptchaToken } from '@/lib/captcha';
import { hasTwoFactorEnabled } from '@/lib/twoFactor';
import { buildLoginUser } from '@/lib/loginResponse';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFromRequest(req);
    const ipLimit = await checkRateLimitDurable(`login:ip:${ip}`, 20, 15 * 60 * 1000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { success: false, error: 'Muitas tentativas. Aguarde e tente novamente.' },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSec || 60) },
        }
      );
    }

    const body = await req.json();
    const { email, password, rememberMe = true, captchaToken } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'E-mail e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    if (!(await verifyCaptchaToken(captchaToken, ip))) {
      return NextResponse.json({ success: false, error: CAPTCHA_ERROR, captcha: true }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const emailLimit = await checkRateLimitDurable(`login:email:${cleanEmail}`, 10, 15 * 60 * 1000);
    if (!emailLimit.ok) {
      return NextResponse.json(
        { success: false, error: 'Muitas tentativas para este e-mail. Aguarde e tente novamente.' },
        {
          status: 429,
          headers: { 'Retry-After': String(emailLimit.retryAfterSec || 60) },
        }
      );
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*, tenants(*)')
      .eq('email', cleanEmail)
      .single();

    const verify = user
      ? await verifyPassword(password, user.password_hash)
      : { ok: false, needsRehash: false };

    // Custo similar quando usuário não existe (mitiga timing/enumeration)
    if (!user) await hashPassword(password);

    if (userError || !user || !verify.ok) {
      return NextResponse.json(
        { success: false, error: 'E-mail ou senha incorretos. Verifique suas credenciais.' },
        { status: 401 }
      );
    }

    let currentPasswordHash: string = user.password_hash;
    if (verify.needsRehash) {
      currentPasswordHash = await hashPassword(password);
      await supabaseAdmin.from('users').update({ password_hash: currentPasswordHash }).eq('id', user.id);
    }

    // Duas etapas ligadas: a senha certa só libera a tela do código (5 min).
    if (hasTwoFactorEnabled(user)) {
      const res = NextResponse.json({ success: true, mfaRequired: true });
      applyMfaChallengeCookie(res, {
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role || 'ADMIN',
        passwordHash: currentPasswordHash,
        rememberMe: Boolean(rememberMe),
      });
      return res;
    }

    await supabaseAdmin.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);

    const res = NextResponse.json({
      success: true,
      message: 'Autenticado com sucesso!',
      user: await buildLoginUser(user),
    });

    applySessionCookie(
      res,
      {
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role || 'ADMIN',
        passwordHash: currentPasswordHash,
      },
      Boolean(rememberMe)
    );
    clearMfaChallengeCookie(res);

    return res;
  } catch (error: any) {
    console.error('[Login API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao processar login.' },
      { status: 500 }
    );
  }
}
