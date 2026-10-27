import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { loadTwoFactorState } from '@/lib/twoFactor';
import { sendEmail, appBaseUrl, contactFooterText } from '@/lib/email';
import { brandedEmailHtml, escapeHtml } from '@/lib/emailTemplates';
import { internalErrorResponse } from '@/lib/errors';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function cleanEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().slice(0, 254);
}

async function findUser(email: string) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('id, name, email, tenant_id, tenants(name)')
    .eq('email', email)
    .maybeSingle();
  return data as { id: string; name: string; email: string; tenant_id: string; tenants?: { name?: string } | null } | null;
}

/** Suporte: situação da verificação em duas etapas de um usuário (?email=). */
export async function GET(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;
  try {
    const email = cleanEmail(new URL(req.url).searchParams.get('email'));
    if (!email.includes('@')) return NextResponse.json({ success: false, error: 'Informe o e-mail.' }, { status: 400 });
    const user = await findUser(email);
    if (!user) return NextResponse.json({ success: true, found: false });
    const state = await loadTwoFactorState(user.id);
    return NextResponse.json({
      success: true,
      found: true,
      user: { name: user.name, email: user.email, company: user.tenants?.name || null },
      ...state,
    });
  } catch (error: unknown) {
    return internalErrorResponse('api.interno.two_factor.get', error);
  }
}

/**
 * Suporte: desliga a verificação em duas etapas de quem perdeu o celular e os
 * códigos de recuperação. { email }. O usuário recebe e-mail avisando.
 */
export async function POST(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: unknown };
    const email = cleanEmail(body.email);
    const user = await findUser(email);
    if (!user) return NextResponse.json({ success: false, error: 'Usuário não encontrado.' }, { status: 404 });

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
      .eq('id', user.id);
    if (error) throw error;

    logger.warn('interno.two_factor_reset', { tenantId: user.tenant_id, by: gate.email });

    // Aviso para o dono da conta: se não foi ele que pediu, ele fica sabendo.
    try {
      const url = `${appBaseUrl()}/configuracoes`;
      await sendEmail({
        to: user.email,
        subject: 'Verificação em duas etapas desligada na sua conta Domu Tech',
        text: `Olá, ${user.name}!\n\nA pedido do suporte, a verificação em duas etapas da sua conta foi desligada. Agora o login pede só e-mail e senha.\n\nSe não foi você quem pediu, troque sua senha e responda este e-mail.\n\nPara ligar de novo: ${url}\n\nEquipe Domu Tech${contactFooterText()}`,
        html: brandedEmailHtml({
          heading: 'Verificação em duas etapas desligada',
          bodyHtml: `<p style="margin:0 0 12px;">Olá, ${escapeHtml(user.name)}!</p>
<p style="margin:0 0 12px;">A pedido do suporte, a verificação em duas etapas da sua conta foi desligada. Agora o login pede só e-mail e senha.</p>
<p style="margin:0 0 12px;"><strong>Se não foi você quem pediu</strong>, troque sua senha e responda este e-mail.</p>`,
          ctaLabel: 'Ligar de novo',
          ctaUrl: url,
        }),
      });
    } catch (err) {
      logger.warn('interno.two_factor_reset_email_failed', { message: err instanceof Error ? err.message : String(err) });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return internalErrorResponse('api.interno.two_factor.post', error);
  }
}
