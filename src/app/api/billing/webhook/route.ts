import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseServer';
import {
  activateTenantSubscription,
  mapAsaasPaymentStatusToSubscription,
  mapAsaasSubscriptionStatus,
} from '@/lib/billing';
import {
  asaasGetPayment,
  asaasGetPixQrCode,
  getAsaasWebhookToken,
  isBillingMockEnabled,
} from '@/lib/asaasClient';
import { getPlanMonthlyLimit, normalizePlanTier } from '@/lib/planLimits';
import { isProduction } from '@/lib/envSecrets';
import { logger } from '@/lib/logger';
import { sendEmail, appBaseUrl, contactFooterText } from '@/lib/email';
import { brandedEmailHtml } from '@/lib/emailTemplates';

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
    const qrImage = pix.encodedImage ? `data:image/png;base64,${pix.encodedImage}` : null;

    const subject = `Pix da sua renovação Domu Tech (${priceLabel})`;
    const text = `Olá!\n\nSua assinatura do plano ${input.planTier} (${priceLabel}/mês) da empresa ${
      tenant?.name || ''
    } renovou e já tem um Pix aguardando pagamento.\n\nPix copia e cola:\n${pix.payload}\n\nOu pague direto no painel: ${billingUrl}\n\nEquipe Domu Tech${contactFooterText()}`;
    const html = brandedEmailHtml({
      heading: 'Pix da sua renovação está pronto',
      bodyHtml: `<p style="margin:0 0 12px;">Olá!</p>
        <p style="margin:0 0 12px;">Sua assinatura do plano <strong>${input.planTier}</strong> (${priceLabel}/mês) da empresa <strong>${
          tenant?.name || ''
        }</strong> renovou e já tem um Pix aguardando pagamento.</p>
        ${qrImage ? `<div style="text-align:center;margin:20px 0;"><img src="${qrImage}" alt="QR Code Pix" width="220" style="display:inline-block;border:1px solid #E2E8F0;border-radius:12px;padding:8px;" /></div>` : ''}
        <p style="margin:0 0 8px;font-weight:700;color:#0B132B;">Pix copia e cola:</p>
        <p style="margin:0;padding:12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;font-family:monospace;font-size:12px;word-break:break-all;color:#334155;">${pix.payload}</p>`,
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
      const externalRef = payment.externalReference || payment.subscription;
      let tenantId: string | null =
        typeof payment.externalReference === 'string'
          ? payment.externalReference
          : null;

      if (!tenantId && payment.subscription) {
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select(
            'tenant_id, plan_tier, monthly_price_brl, payment_method, coupon_code, asaas_customer_id'
          )
          .eq('asaas_subscription_id', payment.subscription)
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
        let verifiedStatus = String(payment.status || '');

        // Confirma status no Asaas (exceto mock local)
        if (!isBillingMockEnabled()) {
          try {
            const verified = await asaasGetPayment(payment.id);
            verifiedStatus = verified.status || verifiedStatus;
          } catch (err) {
            console.error('[Asaas Webhook] Falha ao validar payment no Asaas:', err);
            return NextResponse.json(
              { success: false, error: 'Não foi possível validar o pagamento.' },
              { status: 502 }
            );
          }
        }

        const mapped = mapAsaasPaymentStatusToSubscription(verifiedStatus);
        const { data: current } = await supabaseAdmin
          .from('subscriptions')
          .select(
            'plan_tier, monthly_price_brl, payment_method, coupon_code, asaas_customer_id, asaas_subscription_id, status'
          )
          .eq('tenant_id', tenantId)
          .maybeSingle();

        await supabaseAdmin
          .from('subscriptions')
          .update({
            last_payment_status: verifiedStatus,
            pending_payment_id: payment.id,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId);

        if (mapped === 'ACTIVE') {
          await activateTenantSubscription({
            tenantId,
            planTier: current?.plan_tier || 'STARTER',
            monthlyPrice: Number(current?.monthly_price_brl) || 0,
            paymentMethod:
              current?.payment_method || payment.billingType || 'PIX',
            asaasCustomerId: current?.asaas_customer_id,
            asaasSubscriptionId:
              current?.asaas_subscription_id || payment.subscription,
            couponCode:
              current?.status === 'ACTIVE' ? null : current?.coupon_code || null,
            status: 'ACTIVE',
          });
        } else if (mapped === 'PAST_DUE' || mapped === 'CANCELED') {
          await supabaseAdmin
            .from('subscriptions')
            .update({ status: mapped, updated_at: new Date().toISOString() })
            .eq('tenant_id', tenantId);
        } else if (
          payment.billingType === 'PIX' &&
          current?.status === 'ACTIVE' &&
          current?.asaas_subscription_id &&
          payment.subscription === current.asaas_subscription_id
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
              planTier: current.plan_tier,
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
