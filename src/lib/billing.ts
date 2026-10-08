import {
  getPlanMonthlyLimit,
  getPlanPrice,
  normalizePlanTier,
  PlanTier,
  segmentAfterPlanActivation,
} from '@/lib/planLimits';
import { getLivePlanPrice } from '@/lib/planPricing';
import { notifyTenantAdmins } from '@/lib/notify';
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

/**
 * PIX: 5% off no valor base (antes ou depois do cupom — aplicamos cupom primeiro, depois PIX).
 * `basePrice`, quando informado, sobrepõe o valor padrão de planLimits.ts — use o preço vigente
 * de lib/planPricing.ts (editável no /interno) em vez do fallback estático sempre que possível.
 */
export function computeSubscriptionPrice(input: {
  planTier: string;
  paymentMethod: 'PIX' | 'CREDIT_CARD';
  coupon?: Pick<CouponRow, 'code' | 'percent_off' | 'amount_off_brl'> | null;
  basePrice?: number;
}): PriceBreakdown {
  const planTier = normalizePlanTier(input.planTier);
  const listPrice = input.basePrice ?? getPlanPrice(planTier);
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

  const { data: previousSub } = await supabaseAdmin
    .from('subscriptions')
    .select('status')
    .eq('tenant_id', input.tenantId)
    .maybeSingle();
  const wasAlreadyActive = previousSub?.status === 'ACTIVE';

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
      expiry_reminder_sent_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id' }
  );

  if (status === 'ACTIVE' || status === 'TRIAL') {
    // select('*'): não quebra se a migration de business_segment ainda não rodou.
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', input.tenantId)
      .maybeSingle();
    // Somente Disparos só existe no Starter: plano maior pago = módulo do ramo do cliente.
    const nextSegment = segmentAfterPlanActivation(
      tenant?.segment,
      planTier,
      tenant?.business_segment
    );
    await supabaseAdmin
      .from('tenants')
      .update({
        status: 'ACTIVE',
        ...(nextSegment && nextSegment !== tenant?.segment ? { segment: nextSegment } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.tenantId);
  }

  if (status === 'ACTIVE' && !wasAlreadyActive) {
    await notifyTenantAdmins(input.tenantId, {
      title: 'Assinatura ativada',
      message: `Seu plano ${planTier} está ativo. Bom disparo!`,
      type: 'SUCCESS',
    });
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

/** Conta com assinatura vigente: nova contratação vira TROCA de plano (pendente). */
export function isActiveSubscription(sub: { status?: string | null } | null | undefined): boolean {
  return sub?.status === 'ACTIVE' || sub?.status === 'TRIAL';
}

/** Linha de public.subscriptions (lida com select('*'), colunas novas podem faltar). */
export type SubscriptionRow = {
  plan_tier?: string | null;
  monthly_price_brl?: number | string | null;
  payment_method?: string | null;
  coupon_code?: string | null;
  status?: string | null;
  asaas_customer_id?: string | null;
  asaas_subscription_id?: string | null;
  pending_plan_tier?: string | null;
  pending_monthly_price_brl?: number | string | null;
  pending_payment_method?: string | null;
  pending_coupon_code?: string | null;
  pending_asaas_subscription_id?: string | null;
};

export type PaidPlan = {
  planTier: string;
  monthlyPrice: number;
  paymentMethod: string;
  asaasSubscriptionId: string | null;
  couponCode: string | null;
  /** true = este pagamento efetiva uma troca de plano pendente. */
  isPlanChange: boolean;
};

/**
 * Qual plano ativar quando um pagamento é confirmado. Se o pagamento é da
 * assinatura da TROCA pendente, ativa o plano novo; senão é renovação do
 * plano atual. Sem efeitos colaterais (testável).
 */
export function resolvePaidPlan(
  sub: SubscriptionRow | null | undefined,
  paymentSubscriptionId: string | null | undefined
): PaidPlan {
  const pendingSubId = sub?.pending_asaas_subscription_id || null;
  if (pendingSubId && paymentSubscriptionId && paymentSubscriptionId === pendingSubId) {
    return {
      planTier: sub?.pending_plan_tier || sub?.plan_tier || 'STARTER',
      monthlyPrice: Number(sub?.pending_monthly_price_brl) || 0,
      paymentMethod: sub?.pending_payment_method || sub?.payment_method || 'PIX',
      asaasSubscriptionId: pendingSubId,
      couponCode: sub?.pending_coupon_code || null,
      isPlanChange: true,
    };
  }
  return {
    planTier: sub?.plan_tier || 'STARTER',
    monthlyPrice: Number(sub?.monthly_price_brl) || 0,
    paymentMethod: sub?.payment_method || 'PIX',
    asaasSubscriptionId: sub?.asaas_subscription_id || paymentSubscriptionId || null,
    // Cupom só conta na primeira ativação, não em renovação.
    couponCode: sub?.status === 'ACTIVE' ? null : sub?.coupon_code || null,
    isPlanChange: false,
  };
}

const PENDING_PLAN_CLEARED = {
  pending_plan_tier: null,
  pending_monthly_price_brl: null,
  pending_payment_method: null,
  pending_coupon_code: null,
  pending_asaas_subscription_id: null,
  pending_created_at: null,
};

async function cancelAsaasSubscriptionSafe(id: string | null | undefined, context: string) {
  if (!id) return;
  try {
    const { asaasCancelSubscription, isBillingMockEnabled } = await import('@/lib/asaasClient');
    if (isBillingMockEnabled()) return;
    await asaasCancelSubscription(id);
  } catch (err) {
    // Não derruba a ativação; fica registrado para cancelar à mão no Asaas.
    const { logOpsAlert } = await import('@/lib/opsAlert');
    await logOpsAlert({
      source: 'billing.cancelamento',
      message: `${context}: falha ao cancelar a assinatura ${id} no Asaas — cancele manualmente para evitar cobrança dupla. ${
        err instanceof Error ? err.message : ''
      }`,
    });
  }
}

/**
 * Ativa um pagamento confirmado: renovação do plano atual ou efetivação da
 * troca de plano pendente (aí cancela a assinatura ANTIGA no Asaas e limpa a
 * pendência). Use em todo lugar que confirma pagamento.
 */
export async function activatePaidPayment(input: {
  tenantId: string;
  sub: SubscriptionRow | null | undefined;
  paymentSubscriptionId: string | null | undefined;
  fallbackPaymentMethod?: string | null;
}): Promise<PaidPlan> {
  const plan = resolvePaidPlan(input.sub, input.paymentSubscriptionId);
  const previousAsaasSubId = input.sub?.asaas_subscription_id || null;

  await activateTenantSubscription({
    tenantId: input.tenantId,
    planTier: plan.planTier,
    monthlyPrice: plan.monthlyPrice,
    paymentMethod: plan.paymentMethod || input.fallbackPaymentMethod || 'PIX',
    asaasCustomerId: input.sub?.asaas_customer_id,
    asaasSubscriptionId: plan.asaasSubscriptionId,
    couponCode: plan.couponCode,
    status: 'ACTIVE',
  });

  if (plan.isPlanChange) {
    if (previousAsaasSubId && previousAsaasSubId !== plan.asaasSubscriptionId) {
      await cancelAsaasSubscriptionSafe(previousAsaasSubId, `Troca de plano (${input.tenantId})`);
    }
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update(PENDING_PLAN_CLEARED)
      .eq('tenant_id', input.tenantId);
    if (error) console.warn('[billing] pendência de troca não limpa:', error.message);
  }

  return plan;
}

/**
 * O pagamento da troca venceu/foi cancelado: descarta só a troca. O plano
 * atual continua ativo — nada de marcar a conta como inadimplente.
 */
export async function discardPendingPlanChange(
  tenantId: string,
  sub: SubscriptionRow | null | undefined
): Promise<void> {
  await cancelAsaasSubscriptionSafe(sub?.pending_asaas_subscription_id, `Troca de plano não paga (${tenantId})`);
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ ...PENDING_PLAN_CLEARED, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId);
  if (error) console.warn('[billing] pendência de troca não descartada:', error.message);
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

  // Conta já ativa: NÃO reativa de novo (isso empurrava o vencimento 30 dias a
  // cada consulta de status). Só confere se a troca de plano pendente foi paga.
  if (sub?.status === 'ACTIVE' || sub?.status === 'TRIAL') {
    const pendingSubId = (sub as SubscriptionRow).pending_asaas_subscription_id;
    if (!pendingSubId) return { synced: false, status: sub.status };
    const payments = await asaasListSubscriptionPayments(pendingSubId);
    if (!payments.some((p) => isPaidAsaasPayment(p.status))) {
      return { synced: false, status: sub.status };
    }
    const plan = await activatePaidPayment({ tenantId, sub, paymentSubscriptionId: pendingSubId });
    return { synced: true, planTier: normalizePlanTier(plan.planTier), status: 'ACTIVE' };
  }

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
  const monthlyPrice =
    Number(asaasSub.value) || Number(sub?.monthly_price_brl) || (await getLivePlanPrice(planTier));
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
