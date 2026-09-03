import {
  getPlanMonthlyLimit,
  getPlanPrice,
  normalizePlanTier,
  PlanTier,
} from '@/lib/planLimits';
import { supabaseAdmin } from '@/lib/supabaseServer';

export type CouponRow = {
  code: string;
  percent_off: number | null;
  amount_off_brl: number | null;
  active: boolean;
  max_redemptions: number | null;
  redemption_count: number;
  expires_at: string | null;
  plan_tiers: string[] | null;
  first_invoice_only: boolean;
  description?: string | null;
};

export type PriceBreakdown = {
  planTier: PlanTier;
  listPrice: number;
  pixDiscountPercent: number;
  couponCode: string | null;
  couponPercent: number;
  couponAmount: number;
  finalPrice: number;
};

/** PIX: 5% off no valor base (antes ou depois do cupom — aplicamos cupom primeiro, depois PIX). */
export function computeSubscriptionPrice(input: {
  planTier: string;
  paymentMethod: 'PIX' | 'CREDIT_CARD';
  coupon?: Pick<CouponRow, 'code' | 'percent_off' | 'amount_off_brl'> | null;
}): PriceBreakdown {
  const planTier = normalizePlanTier(input.planTier);
  const listPrice = getPlanPrice(planTier);
  let price = listPrice;
  let couponPercent = 0;
  let couponAmount = 0;
  let couponCode: string | null = null;

  if (input.coupon) {
    couponCode = input.coupon.code.toUpperCase();
    if (input.coupon.percent_off && input.coupon.percent_off > 0) {
      couponPercent = Number(input.coupon.percent_off);
      price = price * (1 - couponPercent / 100);
    } else if (input.coupon.amount_off_brl && input.coupon.amount_off_brl > 0) {
      couponAmount = Number(input.coupon.amount_off_brl);
      price = Math.max(0, price - couponAmount);
    }
  }

  const pixDiscountPercent = input.paymentMethod === 'PIX' ? 5 : 0;
  if (pixDiscountPercent > 0) {
    price = price * (1 - pixDiscountPercent / 100);
  }

  return {
    planTier,
    listPrice,
    pixDiscountPercent,
    couponCode,
    couponPercent,
    couponAmount,
    finalPrice: Math.round(price * 100) / 100,
  };
}

export async function findActiveCoupon(
  code: string,
  planTier?: string
): Promise<{ ok: true; coupon: CouponRow } | { ok: false; error: string }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, error: 'Informe um cupom.' };

  const { data, error } = await supabaseAdmin
    .from('billing_coupons')
    .select('*')
    .eq('code', normalized)
    .maybeSingle();

  if (error) {
    // Tabela ainda não migrada
    if (error.message?.includes('billing_coupons') || error.code === '42P01') {
      return { ok: false, error: 'Cupons ainda não estão habilitados no banco.' };
    }
    return { ok: false, error: 'Não foi possível validar o cupom.' };
  }

  if (!data || !data.active) {
    return { ok: false, error: 'Cupom inválido ou inativo.' };
  }

  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, error: 'Cupom expirado.' };
  }

  if (
    data.max_redemptions != null &&
    Number(data.redemption_count || 0) >= Number(data.max_redemptions)
  ) {
    return { ok: false, error: 'Cupom esgotado.' };
  }

  const tiers = data.plan_tiers as string[] | null;
  if (planTier && Array.isArray(tiers) && tiers.length > 0) {
    if (!tiers.includes(normalizePlanTier(planTier))) {
      return { ok: false, error: 'Cupom não válido para este plano.' };
    }
  }

  return { ok: true, coupon: data as CouponRow };
}

export function mapAsaasPaymentStatusToSubscription(
  paymentStatus: string
): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PENDING_PAYMENT' {
  const s = (paymentStatus || '').toUpperCase();
  if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(s)) return 'ACTIVE';
  if (['OVERDUE'].includes(s)) return 'PAST_DUE';
  if (['REFUNDED', 'DELETED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE'].includes(s)) {
    return 'CANCELED';
  }
  return 'PENDING_PAYMENT';
}

export function mapAsaasSubscriptionStatus(
  status: string
): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PENDING_PAYMENT' {
  const s = (status || '').toUpperCase();
  if (s === 'ACTIVE') return 'ACTIVE';
  if (s === 'EXPIRED') return 'CANCELED';
  if (s === 'INACTIVE') return 'CANCELED';
  return 'PENDING_PAYMENT';
}

export async function activateTenantSubscription(input: {
  tenantId: string;
  planTier: string;
  monthlyPrice: number;
  paymentMethod: string;
  asaasCustomerId?: string | null;
  asaasSubscriptionId?: string | null;
  couponCode?: string | null;
  status?: 'ACTIVE' | 'TRIAL' | 'PENDING_PAYMENT' | 'PAST_DUE' | 'CANCELED';
}) {
  const planTier = normalizePlanTier(input.planTier);
  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  const status = input.status || 'ACTIVE';

  await supabaseAdmin.from('subscriptions').upsert(
    {
      tenant_id: input.tenantId,
      plan_tier: planTier,
      monthly_price_brl: input.monthlyPrice,
      monthly_message_limit: getPlanMonthlyLimit(planTier),
      status,
      payment_method: input.paymentMethod,
      asaas_customer_id: input.asaasCustomerId || null,
      asaas_subscription_id: input.asaasSubscriptionId || null,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      pending_payment_id: null,
      last_payment_status: status === 'ACTIVE' ? 'RECEIVED' : null,
      coupon_code: input.couponCode || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id' }
  );

  if (status === 'ACTIVE' || status === 'TRIAL') {
    await supabaseAdmin
      .from('tenants')
      .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
      .eq('id', input.tenantId);
  }

  if (input.couponCode && status === 'ACTIVE') {
    const code = input.couponCode.toUpperCase();
    const { data: coupon } = await supabaseAdmin
      .from('billing_coupons')
      .select('redemption_count')
      .eq('code', code)
      .maybeSingle();
    if (coupon) {
      await supabaseAdmin
        .from('billing_coupons')
        .update({
          redemption_count: Number(coupon.redemption_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('code', code);
    }
  }
}

export function isSubscriptionAllowedToDispatch(status: string | null | undefined): boolean {
  return status === 'ACTIVE' || status === 'TRIAL';
}

const PAID_PAYMENT_STATUSES = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'] as const;

export function parsePlanTierFromAsaasDescription(description: string): PlanTier | null {
  const d = (description || '').toUpperCase();
  if (d.includes('ENTERPRISE')) return 'ENTERPRISE';
  if (d.includes('PRO')) return 'PRO';
  if (d.includes('STARTER')) return 'STARTER';
  return null;
}

function isPaidAsaasPayment(status: string | null | undefined): boolean {
  return PAID_PAYMENT_STATUSES.includes(
    (status || '').toUpperCase() as (typeof PAID_PAYMENT_STATUSES)[number]
  );
}

/** Sincroniza assinatura local com o Asaas (útil sem webhook em localhost). */
export async function syncTenantSubscriptionFromAsaas(
  tenantId: string,
  userEmail?: string | null
): Promise<{ synced: boolean; planTier?: PlanTier; status?: string }> {
  const { isBillingMockEnabled } = await import('@/lib/asaasClient');
  if (isBillingMockEnabled()) return { synced: false };

  const {
    asaasFindCustomerByEmail,
    asaasGetSubscription,
    asaasListCustomerSubscriptions,
    asaasListSubscriptionPayments,
    getAsaasApiKey,
  } = await import('@/lib/asaasClient');

  if (!getAsaasApiKey()) return { synced: false };

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (sub?.status === 'CANCELED') return { synced: false, status: 'CANCELED' };

  let asaasSub: Awaited<ReturnType<typeof asaasGetSubscription>> | null = null;
  let paidPayment: Awaited<ReturnType<typeof asaasListSubscriptionPayments>>[number] | null =
    null;

  const pickBestPaidSubscription = async (
    subs: Awaited<ReturnType<typeof asaasListCustomerSubscriptions>>
  ) => {
    let bestSub: (typeof subs)[number] | null = null;
    let bestPayment: Awaited<ReturnType<typeof asaasListSubscriptionPayments>>[number] | null =
      null;

    for (const candidate of subs) {
      if (candidate.status === 'INACTIVE' || candidate.status === 'EXPIRED') continue;
      const payments = await asaasListSubscriptionPayments(candidate.id);
      const paid = payments.find((p) => isPaidAsaasPayment(p.status));
      if (!paid) continue;
      if (!bestSub || Number(candidate.value) >= Number(bestSub.value)) {
        bestSub = candidate;
        bestPayment = paid;
      }
    }

    return { bestSub, bestPayment };
  };

  if (userEmail) {
    const customer = await asaasFindCustomerByEmail(userEmail);
    if (customer) {
      const subs = await asaasListCustomerSubscriptions(customer.id);
      const picked = await pickBestPaidSubscription(subs);
      asaasSub = picked.bestSub;
      paidPayment = picked.bestPayment;
    }
  }

  if (!asaasSub && sub?.asaas_subscription_id) {
    try {
      asaasSub = await asaasGetSubscription(sub.asaas_subscription_id);
      const payments = await asaasListSubscriptionPayments(asaasSub.id);
      paidPayment = payments.find((p) => isPaidAsaasPayment(p.status)) || null;
    } catch {
      asaasSub = null;
    }
  }

  if (!asaasSub || !paidPayment) return { synced: false, status: 'PENDING_PAYMENT' };

  const planTier =
    parsePlanTierFromAsaasDescription(asaasSub.description || '') ||
    normalizePlanTier(sub?.plan_tier || 'STARTER');
  const monthlyPrice = Number(asaasSub.value) || Number(sub?.monthly_price_brl) || getPlanPrice(planTier);
  const paymentMethod = asaasSub.billingType === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX';

  await activateTenantSubscription({
    tenantId,
    planTier,
    monthlyPrice,
    paymentMethod,
    asaasCustomerId: typeof asaasSub.customer === 'string' ? asaasSub.customer : sub?.asaas_customer_id,
    asaasSubscriptionId: asaasSub.id,
    couponCode: sub?.coupon_code || null,
    status: 'ACTIVE',
  });

  return { synced: true, planTier, status: 'ACTIVE' };
}
