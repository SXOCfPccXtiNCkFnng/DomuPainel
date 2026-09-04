import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import {
  activateTenantSubscription,
  mapAsaasPaymentStatusToSubscription,
  mapAsaasSubscriptionStatus,
} from '@/lib/billing';
import {
  asaasGetPayment,
  getAsaasWebhookToken,
  isBillingMockEnabled,
} from '@/lib/asaasClient';
import { getPlanMonthlyLimit, normalizePlanTier } from '@/lib/planLimits';
import { isProduction } from '@/lib/envSecrets';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

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
    if (got !== expected) {
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
