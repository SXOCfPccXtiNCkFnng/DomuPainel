import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { isCronRequest } from '@/lib/cronAuth';
import { sendEmail, appBaseUrl, contactFooterText } from '@/lib/email';
import { brandedEmailHtml } from '@/lib/emailTemplates';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const REMINDER_WINDOW_DAYS = 3;

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Cron diário: avisa por e-mail os admins de tenants com assinatura ACTIVE
 * vencendo em até 3 dias. Marca expiry_reminder_sent_at para não repetir o
 * aviso todo dia — activateTenantSubscription() zera esse campo a cada
 * renovação, liberando um novo aviso no próximo ciclo.
 */
export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized cron.' }, { status: 401 });
  }

  try {
    const nowIso = new Date().toISOString();
    const windowEndIso = new Date(
      Date.now() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: expiring, error } = await supabaseAdmin
      .from('subscriptions')
      .select('tenant_id, plan_tier, monthly_price_brl, current_period_end')
      .eq('status', 'ACTIVE')
      .gte('current_period_end', nowIso)
      .lte('current_period_end', windowEndIso)
      .is('expiry_reminder_sent_at', null);

    if (error) throw error;

    let notified = 0;
    const base = appBaseUrl();

    for (const sub of expiring || []) {
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('name')
        .eq('id', sub.tenant_id)
        .maybeSingle();

      const { data: admins } = await supabaseAdmin
        .from('users')
        .select('email, name')
        .eq('tenant_id', sub.tenant_id)
        .eq('role', 'ADMIN');

      const recipients = (admins || []).map((a) => a.email).filter(Boolean);
      if (recipients.length === 0) continue;

      const expiresAt = formatDateBR(sub.current_period_end);
      const renewUrl = `${base}/assinatura`;
      const priceLabel = Number(sub.monthly_price_brl || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });

      const subject = `Sua assinatura Domu Tech vence em breve (${expiresAt})`;
      const text = `Olá!\n\nA assinatura do plano ${sub.plan_tier} (${priceLabel}/mês) da empresa ${
        tenant?.name || ''
      } vence em ${expiresAt}.\n\nPara continuar disparando campanhas sem interrupção, renove em: ${renewUrl}\n\nEquipe Domu Tech${contactFooterText()}`;
      const html = brandedEmailHtml({
        heading: 'Sua assinatura vence em breve',
        bodyHtml: `<p style="margin:0 0 12px;">Olá!</p>
          <p style="margin:0 0 12px;">A assinatura do plano <strong>${sub.plan_tier}</strong> (${priceLabel}/mês) da empresa <strong>${
            tenant?.name || ''
          }</strong> vence em <strong>${expiresAt}</strong>.</p>
          <p style="margin:0;">Para continuar disparando campanhas sem interrupção, renove antes dessa data.</p>`,
        ctaLabel: 'Renovar assinatura',
        ctaUrl: renewUrl,
      });

      const results = await Promise.all(
        recipients.map((to) => sendEmail({ to, subject, text, html }))
      );

      if (results.some((r) => r.ok)) {
        await supabaseAdmin
          .from('subscriptions')
          .update({ expiry_reminder_sent_at: new Date().toISOString() })
          .eq('tenant_id', sub.tenant_id);
        notified += 1;
      }
    }

    return NextResponse.json({ success: true, checked: (expiring || []).length, notified });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro no expiry-check.';
    logger.error('billing.expiry_check_error', { message });
    const { logOpsAlert } = await import('@/lib/opsAlert');
    await logOpsAlert({ source: 'cron.expiry-check', message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
