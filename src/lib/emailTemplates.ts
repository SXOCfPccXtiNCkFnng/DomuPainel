import { appBaseUrl } from '@/lib/email';
import { CONTACT_EMAIL, CONTACT_WHATSAPP_URL } from '@/lib/contact';

/**
 * Escapa texto para interpolar em HTML de e-mail. Use em TODO dado vindo de
 * usuário/banco (nome, empresa, plano...) — senão alguém se cadastra com nome
 * `<a href="...">` e manda phishing com a marca e o domínio da Domu.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Casca visual padrão dos e-mails transacionais: logo, cartão branco com o
 * conteúdo e rodapé com contato. Table-based + estilos inline de propósito —
 * é o que sobrevive à sanitização de HTML de clientes de e-mail (Gmail,
 * Outlook etc.), diferente de <style> ou classes CSS.
 */
export function brandedEmailHtml({
  heading,
  bodyHtml,
  ctaLabel,
  ctaUrl,
}: {
  heading: string;
  /** HTML cru — escape os dados dinâmicos com escapeHtml antes de montar. */
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const logoUrl = `${appBaseUrl()}/logo-com-nome.png`;
  const wa = CONTACT_WHATSAPP_URL('Olá! Preciso de ajuda com a Plataforma Domu Tech.');

  const cta =
    ctaUrl && ctaLabel
      ? `<tr>
          <td align="center" style="padding-top:28px;text-align:center;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#1E5AF6;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 30px;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${escapeHtml(ctaLabel)}</a>
          </td>
        </tr>`
      : '';

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#F8FAFC;">
    <div style="background:#F8FAFC;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
        <tr>
          <td style="padding:0 0 28px;text-align:center;">
            <img src="${logoUrl}" alt="Domu Tech" width="150" style="display:block;margin:0 auto;height:auto;border:0;" />
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;border:1px solid #E2E8F0;border-radius:16px;padding:40px 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <h1 align="center" style="margin:0 0 16px;text-align:center;font-size:20px;line-height:1.35;color:#0B132B;font-weight:800;">${escapeHtml(heading)}</h1>
                  <div style="font-size:14px;line-height:1.75;color:#475569;">
                    ${bodyHtml}
                  </div>
                </td>
              </tr>
              ${cta}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 12px 0;text-align:center;font-size:12px;color:#94A3B8;line-height:1.7;">
            Precisa de ajuda? Fale pelo
            <a href="${wa}" style="color:#1E5AF6;text-decoration:none;font-weight:600;">WhatsApp</a>
            ou pelo
            <a href="mailto:${CONTACT_EMAIL}" style="color:#1E5AF6;text-decoration:none;font-weight:600;">e-mail</a>.
            <br />
            © ${new Date().getFullYear()} Domu Tech ·
            <a href="https://domutech.digital" style="color:#94A3B8;text-decoration:none;">domutech.digital</a>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;
}
