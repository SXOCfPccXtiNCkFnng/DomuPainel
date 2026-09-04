import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { CONTACT_EMAIL, CONTACT_WHATSAPP_URL } from '@/lib/contact';

/** Rodapé de contato para e-mails automáticos voltados ao cliente (não usar em alertas internos). */
export function contactFooterHtml(): string {
  const wa = CONTACT_WHATSAPP_URL('Olá! Preciso de ajuda com o Portal Domu Tech.');
  return `<p style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
    Precisa de ajuda? Fale com a gente pelo <a href="${wa}">WhatsApp</a> ou pelo e-mail
    <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.
  </p>`;
}

export function contactFooterText(): string {
  const wa = CONTACT_WHATSAPP_URL('Olá! Preciso de ajuda com o Portal Domu Tech.');
  return `\n\n---\nPrecisa de ajuda? Fale com a gente:\nWhatsApp: ${wa}\nE-mail: ${CONTACT_EMAIL}`;
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Envia e-mail via Resend se RESEND_API_KEY estiver configurado.
 * Em produção sem chave, falha. Em dev, loga sem o link/token completo.
 */
export async function sendEmail(
  input: SendEmailInput
): Promise<{ ok: boolean; mode: 'resend' | 'dev'; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Domu Tech <onboarding@resend.dev>';
  const isProd = process.env.NODE_ENV === 'production';

  if (!apiKey) {
    if (isProd) {
      logger.error('email.missing_resend_key');
      return {
        ok: false,
        mode: 'resend',
        error: 'Envio de e-mail não configurado (RESEND_API_KEY).',
      };
    }
    logger.info('email.dev_fallback', {
      to: input.to,
      subject: input.subject,
      // Não logar URL com token
      textPreview: input.text.replace(/https?:\/\/\S+/g, '[link]').slice(0, 200),
    });
    return { ok: true, mode: 'dev' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error('email.resend_failed', { status: res.status, body: body.slice(0, 300) });
      return { ok: false, mode: 'resend', error: 'Falha ao enviar e-mail.' };
    }

    logger.info('email.sent', { to: input.to, subject: input.subject });
    return { ok: true, mode: 'resend' };
  } catch (err: any) {
    logger.error('email.exception', { message: err?.message });
    return { ok: false, mode: 'resend', error: err?.message || 'Erro ao enviar e-mail.' };
  }
}

export function appBaseUrl(reqOrigin?: string): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    reqOrigin ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}
