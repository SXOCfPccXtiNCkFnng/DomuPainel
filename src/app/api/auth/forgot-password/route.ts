import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { checkRateLimit, clientIpFromRequest } from '@/lib/rateLimit';
import {
  appBaseUrl,
  contactFooterHtml,
  contactFooterText,
  generateSecureToken,
  hashToken,
  sendEmail,
} from '@/lib/email';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFromRequest(req);
    const limit = checkRateLimit(`forgot:ip:${ip}`, 8, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Muitas solicitações. Aguarde e tente novamente.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec || 60) } }
      );
    }

    const body = await req.json();
    const email = String(body.email || '')
      .toLowerCase()
      .trim();

    const generic = {
      success: true,
      message:
        'Se o e-mail existir na Domu Tech, enviaremos um link para redefinir a senha.',
    };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(generic);
    }

    const emailLimit = checkRateLimit(`forgot:email:${email}`, 5, 60 * 60 * 1000);
    if (!emailLimit.ok) {
      return NextResponse.json(generic);
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .eq('email', email)
      .maybeSingle();

    if (!user) {
      logger.info('auth.forgot_unknown_email', { email });
      return NextResponse.json(generic);
    }

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from('password_reset_tokens')
      .delete()
      .eq('user_id', user.id)
      .is('used_at', null);

    const { error: insertError } = await supabaseAdmin.from('password_reset_tokens').insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (insertError) {
      logger.error('auth.forgot_token_insert', { message: insertError.message });
      return NextResponse.json(
        { success: false, error: 'Não foi possível iniciar a recuperação. Tente novamente.' },
        { status: 500 }
      );
    }

    const base = appBaseUrl(req.nextUrl.origin);
    const resetUrl = `${base}/redefinir-senha?token=${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Redefinir senha — Domu Tech',
      text: `Olá ${user.name},\n\nUse o link abaixo para redefinir sua senha (válido por 1 hora):\n${resetUrl}\n\nSe você não pediu isso, ignore este e-mail.${contactFooterText()}`,
      html: `<p>Olá <strong>${user.name}</strong>,</p>
        <p>Use o link abaixo para redefinir sua senha (válido por <strong>1 hora</strong>):</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Se você não pediu isso, ignore este e-mail.</p>
        ${contactFooterHtml()}`,
    });

    logger.info('auth.forgot_sent', { userId: user.id });
    return NextResponse.json(generic);
  } catch (error: any) {
    logger.error('auth.forgot_error', { message: error?.message });
    return NextResponse.json(
      { success: false, error: 'Erro interno ao processar solicitação.' },
      { status: 500 }
    );
  }
}
