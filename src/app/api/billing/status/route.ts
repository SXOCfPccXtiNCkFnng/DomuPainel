import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import {
  asaasGetPayment,
  asaasGetPixQrCode,
  isBillingMockEnabled,
  AsaasApiError,
} from '@/lib/asaasClient';
import { activateTenantSubscription, mapAsaasPaymentStatusToSubscription, syncTenantSubscriptionFromAsaas } from '@/lib/billing';

export const dynamic = 'force-dynamic';

/** Consulta status do pagamento pendente (polling no onboarding). */
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    const userId = auth.session.userId;

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    let { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!sub) {
      return NextResponse.json({ success: true, status: null, isOnboarded: false });
    }

    // Tenta sincronizar com Asaas (pagamento confirmado lá mas webhook não chegou)
    try {
      const sync = await syncTenantSubscriptionFromAsaas(tenantId, user?.email);
      if (sync.synced) {
        const { data: refreshed } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (refreshed) sub = refreshed;
      }
    } catch (syncErr) {
      console.warn('[Billing Status] Asaas sync failed:', syncErr);
    }

    const reqPaymentId = req.nextUrl.searchParams.get('paymentId');
    const hasPendingPayment = reqPaymentId || sub.pending_payment_id;

    // Only return early if there's no pending payment to check
    if ((sub.status === 'ACTIVE' || sub.status === 'TRIAL') && !hasPendingPayment) {
      return NextResponse.json({
        success: true,
        status: sub.status,
        isOnboarded: true,
        planTier: sub.plan_tier,
      });
    }

    if (isBillingMockEnabled()) {
      return NextResponse.json({
        success: true,
        status: sub.status,
        isOnboarded: false,
        mock: true,
      });
    }

    const paymentId =
      req.nextUrl.searchParams.get('paymentId') || sub.pending_payment_id || null;

    let pix = null;
    let invoiceUrl: string | null = null;
    let paymentStatus = sub.last_payment_status;

    if (paymentId) {
      try {
        const payment = await asaasGetPayment(paymentId);
        paymentStatus = payment.status;
        invoiceUrl = payment.invoiceUrl || null;

        const mapped = mapAsaasPaymentStatusToSubscription(payment.status);
        if (mapped === 'ACTIVE') {
          await activateTenantSubscription({
            tenantId,
            planTier: sub.plan_tier,
            monthlyPrice: Number(sub.monthly_price_brl) || 0,
            paymentMethod: sub.payment_method || 'PIX',
            asaasCustomerId: sub.asaas_customer_id,
            asaasSubscriptionId: sub.asaas_subscription_id,
            couponCode: sub.status === 'ACTIVE' ? null : sub.coupon_code,
            status: 'ACTIVE',
          });
          return NextResponse.json({
            success: true,
            status: 'ACTIVE',
            isOnboarded: true,
            planTier: sub.plan_tier,
            paymentStatus,
            invoiceUrl,
          });
        }

        if (sub.payment_method === 'PIX') {
          try {
            pix = await asaasGetPixQrCode(paymentId);
          } catch {
            pix = null;
          }
        }

        await supabaseAdmin
          .from('subscriptions')
          .update({
            last_payment_status: paymentStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId);
      } catch (err) {
        if (!(err instanceof AsaasApiError)) throw err;
      }
    }

    return NextResponse.json({
      success: true,
      status: sub.status,
      isOnboarded: false,
      paymentStatus,
      paymentId,
      invoiceUrl,
      pix,
      planTier: sub.plan_tier,
      priceBrl: sub.monthly_price_brl,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao consultar pagamento.',
      },
      { status: 500 }
    );
  }
}
