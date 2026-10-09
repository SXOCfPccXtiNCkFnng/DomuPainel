import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseServer';
import {
  activatePaidPayment,
  discardPendingPlanChange,
  mapAsaasPaymentStatusToSubscription,
  mapAsaasSubscriptionStatus,
  type SubscriptionRow,
} from '@/lib/billing';
import {
  asaasGetPayment,
  asaasGetPixQrCode,
  getAsaasWebhookToken,
  isBillingMockEnabled,
} from '@/lib/asaasClient';
import { getPlanDisplayName, getPlanMonthlyLimit, normalizePlanTier } from '@/lib/planLimits';
import { isProduction } from '@/lib/envSecrets';
import { logger } from '@/lib/logger';
import { sendEmail, appBaseUrl, contactFooterText } from '@/lib/email';
import { brandedEmailHtml, escapeHtml } from '@/lib/emailTemplates';

export const dynamic = 'force-dynamic';

/**
 * Quando o Asaas gera automaticamente a cobrança do próximo ciclo de uma
 * assinatura PIX já ativa, ele não avisa o cliente (notificationDisabled=true
 * no customer). Buscamos o QR/copia-e-cola dessa cobrança nova e mandamos
 * por e-mail, em vez de deixar o cliente descobrir sozinho no painel.
 * Best-effort: nunca deve derrubar o processamento do webhook.
 */
async function sendPixRenewalEmail(input: {
  tenantId: string;
  paymentId: string;
  planTier: string;
  monthlyPrice: number;
}): Promise<void> {
  try {
    const pix = await asaasGetPixQrCode(input.paymentId);
    if (!pix?.payload) return;

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', input.tenantId)
      .maybeSingle();

    const { data: admins } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('tenant_id', input.tenantId)
      .eq('role', 'ADMIN');

    const recipients = (admins || []).map((a) => a.email).filter(Boolean);
    if (recipients.length === 0) return;

    const base = appBaseUrl();
    const billingUrl = `${base}/assinatura`;
    const priceLabel = Number(input.monthlyPrice || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    // Sem QR em imagem: o Gmail (e outros) bloqueiam imagem "data:" base64 e ela
    // chegava quebrada. O copia e cola funciona em qualquer app de banco; o QR
    // fica no painel.
    const planName = getPlanDisplayName(input.planTier);

    const subject = `Pix da sua renovação Domu Tech (${priceLabel})`;
    const text = `Olá!\n\nSua assinatura do plano ${planName} (${priceLabel}/mês) da empresa ${
      tenant?.name || ''
    } renovou e já tem um Pix aguardando pagamento.\n\nPix copia e cola:\n${pix.payload}\n\nOu pague direto no painel: ${billingUrl}\n\nEquipe Domu Tech${contactFooterText()}`;
    const html = brandedEmailHtml({
      heading: 'Pix da sua renovação está pronto',
      bodyHtml: `<p style="margin:0 0 12px;">Olá!</p>
        <p style="margin:0 0 12px;">Sua assinatura do plano <strong>${escapeHtml(planName)}</strong> (${priceLabel}/mês) da empresa <strong>${escapeHtml(
          tenant?.name || ''
        )}</strong> renovou e já tem um Pix aguardando pagamento.</p>
        <p style="margin:0 0 12px;">Copie o código abaixo e cole na opção <strong>Pix copia e cola</strong> do app do seu banco. Se preferir ler o QR Code, ele está no painel.</p>
        <p style="margin:0 0 8px;font-weight:700;color:#0B132B;">Pix copia e cola:</p>
        <p style="margin:0;padding:12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;font-family:monospace;font-size:12px;word-break:break-all;color:#334155;">${escapeHtml(pix.payload)}</p>`,
      ctaLabel: 'Pagar no painel',
      ctaUrl: billingUrl,
    });

    const results = await Promise.all(
      recipients.map((to) => sendEmail({ to, subject, text, html }))
    );

    if (results.some((r) => r.ok)) {
      await supabaseAdmin
        .from('subscriptions')
        .update({ pix_renewal_email_sent_for_payment_id: input.paymentId })
        .eq('tenant_id', input.tenantId);
    }
  } catch (err) {
    logger.error('billing.pix_renewal_email_error', {
      tenantId: input.tenantId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Webhook Asaas.
 * Configure em: Integrações → Webhooks
 * URL: https://painel.domutech.digital/api/billing/webhook
 * Token obrigatório: header asaas-access-token = ASAAS_WEBHOOK_TOKEN
 */
export async function POST(req: NextRequest) {
  try {
    const expected = getAsaasWebhookToken();
    if (!expected) {
      console.error('[Asaas Webhook] ASAAS_WEBHOOK_TOKEN não configurado.');
      return NextResponse.json(
        { success: false, error: 'Webhook não configurado.' },
        { status: isProduction() ? 503 : 401 }
      );
    }

    const got =
      req.headers.get('asaas-access-token') ||
      req.headers.get('Asaas-Access-Token') ||
      '';
    const gotBuf = Buffer.from(got);
    const expectedBuf = Buffer.from(expected);
    const tokenMatches =
      gotBuf.length === expectedBuf.length && crypto.timingSafeEqual(gotBuf, expectedBuf);
    if (!tokenMatches) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized webhook.' },
        { status: 401 }
      );
    }

    const payload = await req.json();
    const event = String(payload?.event || '');
    const payment = payload?.payment;
    const subscription = payload?.subscription;

    // Pagamento — validar status real na API Asaas antes de ativar
    if (payment?.id) {
      // Busca o pagamento direto no Asaas ANTES de decidir de qual tenant ele é:
      // status, externalReference e subscription vêm da fonte, não do payload.
      let source = payment as typeof payment & {
        externalReference?: string;
        subscription?: string;
        status?: string;
      };
      if (!isBillingMockEnabled()) {
        try {
          source = { ...payment, ...(await asaasGetPayment(payment.id)) };
        } catch (err) {
          console.error('[Asaas Webhook] Falha ao validar payment no Asaas:', err);
          return NextResponse.json(
            { success: false, error: 'Não foi possível validar o pagamento.' },
            { status: 502 }
          );
        }
      }

      const externalRef = source.externalReference || source.subscription;
      let tenantId: string | null =
        typeof source.externalReference === 'string' ? source.externalReference : null;

      if (!tenantId && source.subscription) {
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('tenant_id')
          .eq('asaas_subscription_id', source.subscription)
          .maybeSingle();
        if (sub) tenantId = sub.tenant_id;
      }

      if (!tenantId) {
        const { data: subByPay } = await supabaseAdmin
          .from('subscriptions')
          .select('tenant_id')
          .eq('pending_payment_id', payment.id)
          .maybeSingle();
        tenantId = subByPay?.tenant_id || null;
      }

      if (tenantId) {
        const verifiedStatus = String(source.status || '');

        const mapped = mapAsaasPaymentStatusToSubscription(verifiedStatus);
        // select('*'): inclui as colunas da troca de plano pendente (se a migration rodou).
        const { data: currentRow } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        const current = currentRow as (SubscriptionRow & { status?: string | null }) | null;

        const paymentSubId = source.subscription || null;
        const isPendingPlanPayment = Boolean(
          current?.pending_asaas_subscription_id &&
            paymentSubId === current.pending_asaas_subscription_id
        );
        // Pagamento de uma assinatura que não é a atual nem a da troca pendente
        // (ex.: a antiga, já cancelada após uma troca): não mexe na conta.
        const isForeignSubscription = Boolean(
          paymentSubId &&
            current?.asaas_subscription_id &&
            paymentSubId !== current.asaas_subscription_id &&
            !isPendingPlanPayment
        );

        await supabaseAdmin
          .from('subscriptions')
          .update({
            last_payment_status: verifiedStatus,
            pending_payment_id: payment.id,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId);

        if (isForeignSubscription) {
          logger.info('billing.webhook_foreign_subscription_ignored', {
            paymentId: payment.id,
            paymentSubId,
            mapped,
          });
        } else if (mapped === 'ACTIVE') {
          await activatePaidPayment({
            tenantId,
            sub: current,
            paymentSubscriptionId: paymentSubId,
            fallbackPaymentMethod: source.billingType,
          });
        } else if ((mapped === 'PAST_DUE' || mapped === 'CANCELED') && isPendingPlanPayment) {
          // Pix do upgrade venceu/foi cancelado: descarta só a troca, o plano atual segue ativo.
          await discardPendingPlanChange(tenantId, current);
        } else if (mapped === 'PAST_DUE' || mapped === 'CANCELED') {
          await supabaseAdmin
            .from('subscriptions')
            .update({ status: mapped, updated_at: new Date().toISOString() })
            .eq('tenant_id', tenantId);
        } else if (
          source.billingType === 'PIX' &&
          current?.status === 'ACTIVE' &&
          current?.asaas_subscription_id &&
          source.subscription === current.asaas_subscription_id
        ) {
          // Assinatura já ativa + cobrança nova pendente no mesmo asaas_subscription_id
          // = o Asaas gerou o próximo ciclo automaticamente. Avisa o cliente com o Pix.
          // Coluna de dedupe consultada à parte (nunca deve derrubar a ativação de pagamento
          // acima se a migration ainda não tiver rodado em produção).
          const { data: dedupe } = await supabaseAdmin
            .from('subscriptions')
            .select('pix_renewal_email_sent_for_payment_id')
            .eq('tenant_id', tenantId)
            .maybeSingle();
          if (dedupe?.pix_renewal_email_sent_for_payment_id !== payment.id) {
            await sendPixRenewalEmail({
              tenantId,
              paymentId: payment.id,
              planTier: current.plan_tier || 'STARTER',
              monthlyPrice: Number(current.monthly_price_brl) || 0,
            });
          }
        }

        logger.info('billing.webhook_payment', { event, paymentId: payment.id, verifiedStatus, externalRef });
      }
    }

    // Assinatura
    if (subscription?.id && !payment) {
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('tenant_id, plan_tier')
        .eq('asaas_subscription_id', subscription.id)
        .maybeSingle();

      if (sub?.tenant_id) {
        const mapped = mapAsaasSubscriptionStatus(subscription.status);
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: mapped === 'ACTIVE' ? 'ACTIVE' : mapped,
            plan_tier: normalizePlanTier(sub.plan_tier),
            monthly_message_limit: getPlanMonthlyLimit(sub.plan_tier),
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', sub.tenant_id);

        if (mapped === 'ACTIVE') {
          await supabaseAdmin
            .from('tenants')
            .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
            .eq('id', sub.tenant_id);
        }
      }
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error: unknown) {
    console.error('[Asaas Webhook Error]', error);
    const { logOpsAlert } = await import('@/lib/opsAlert');
    await logOpsAlert({
      source: 'billing.webhook',
      message: error instanceof Error ? error.message : 'Erro no webhook Asaas.',
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Webhook error',
      },
      { status: 500 }
    );
  }
}
