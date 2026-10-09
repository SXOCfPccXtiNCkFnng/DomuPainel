import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { isCronRequest } from '@/lib/cronAuth';
import { sendEmail, appBaseUrl, contactFooterText } from '@/lib/email';
import { brandedEmailHtml, escapeHtml } from '@/lib/emailTemplates';
import { notifyTenantAdmins } from '@/lib/notify';
import { logger } from '@/lib/logger';
import { getPlanDisplayName } from '@/lib/planLimits';
import { describeError, withTransientRetry } from '@/lib/errors';

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

    const expiring = await withTransientRetry(async () => {
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .select('tenant_id, plan_tier, monthly_price_brl, current_period_end, payment_method, asaas_subscription_id')
        .eq('status', 'ACTIVE')
        .gte('current_period_end', nowIso)
        .lte('current_period_end', windowEndIso)
        .is('expiry_reminder_sent_at', null);
      if (error) throw error;
      return data;
    });

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
      const planName = getPlanDisplayName(sub.plan_tier);
      const price = Number(sub.monthly_price_brl || 0);
      // Acesso de cortesia (liberado no /interno) fica com R$ 0: não mostrar "R$ 0,00/mês".
      const priceSuffix =
        price > 0
          ? ` (${price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês)`
          : '';
      // Cartão com assinatura na Asaas renova sozinho: "renove" assustaria à toa.
      const autoRenews = sub.payment_method === 'CREDIT_CARD' && Boolean(sub.asaas_subscription_id);
      const company = tenant?.name || '';

      const subject = autoRenews
        ? `Sua assinatura Domu Tech renova em ${expiresAt}`
        : `Sua assinatura Domu Tech vence em breve (${expiresAt})`;
      const nextStep = autoRenews
        ? 'A renovação é cobrada automaticamente no cartão cadastrado — você não precisa fazer nada. Se quiser trocar o cartão ou o plano, acesse sua assinatura.'
        : 'Para continuar disparando campanhas sem interrupção, renove antes dessa data.';
      const text = `Olá!\n\nA assinatura do plano ${planName}${priceSuffix} da empresa ${company} ${
        autoRenews ? 'renova' : 'vence'
      } em ${expiresAt}.\n\n${nextStep}\n${renewUrl}\n\nEquipe Domu Tech${contactFooterText()}`;
      const html = brandedEmailHtml({
        heading: autoRenews ? 'Sua assinatura renova em breve' : 'Sua assinatura vence em breve',
        bodyHtml: `<p style="margin:0 0 12px;">Olá!</p>
          <p style="margin:0 0 12px;">A assinatura do plano <strong>${escapeHtml(planName)}</strong>${priceSuffix} da empresa <strong>${escapeHtml(
            company
          )}</strong> ${autoRenews ? 'renova' : 'vence'} em <strong>${expiresAt}</strong>.</p>
          <p style="margin:0;">${nextStep}</p>`,
        ctaLabel: autoRenews ? 'Ver assinatura' : 'Renovar assinatura',
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
        await notifyTenantAdmins(sub.tenant_id, {
          title: 'Assinatura vence em breve',
          message: autoRenews
            ? `Seu plano ${planName} renova em ${expiresAt}, cobrado automaticamente no cartão.`
            : `Seu plano ${planName} vence em ${expiresAt}. Renove pra não perder o acesso.`,
          type: 'WARNING',
        });
        notified += 1;
      }
    }

    return NextResponse.json({ success: true, checked: (expiring || []).length, notified });
  } catch (error: unknown) {
    const message = describeError(error);
    logger.error('billing.expiry_check_error', { message });
    const { logOpsAlert } = await import('@/lib/opsAlert');
    await logOpsAlert({ source: 'cron.expiry-check', message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
