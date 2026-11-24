import {
  getPlanMonthlyLimit,
  getPlanPrice,
  normalizePlanTier,
  PlanTier,
  segmentAfterPlanActivation,
} from '@/lib/planLimits';
import { getTenantPlanPrice } from '@/lib/planPricing';
import { notifyTenantAdmins } from '@/lib/notify';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { after } from 'next/server';

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
  /** Cupom de dias grátis (sem desconto no valor). */
  free_days?: number | null;
  /** Desconto de entrada: o % vale só nas N primeiras mensalidades pagas (junto com dias grátis). */
  discount_months?: number | null;
  description?: string | null;
};

export type PriceBreakdown = {
  planTier: PlanTier;
  listPrice: number;
  pixDiscountPercent: number;
  couponCode: string | null;
  couponPercent: number;
  couponAmount: number;
  /** Dias grátis antes da primeira cobrança (0 = cobra hoje). */
  freeDays: number;
  finalPrice: number;
  /** Desconto de entrada: quantas mensalidades pagas saem por finalPrice (0 = o preço não muda depois). */
  discountMonths: number;
  /** Mensalidade depois do desconto de entrada (com o desconto do PIX, se for o caso). */
  fullPrice: number;
};

export function couponFreeDays(coupon: Pick<CouponRow, 'free_days'> | null | undefined): number {
  const days = Math.floor(Number(coupon?.free_days || 0));
  return days >= 1 && days <= 365 ? days : 0;
}

/**
 * Dias grátis só na primeira assinatura da empresa: quem já teve plano
 * (ativo, teste, vencido ou cancelado) não ganha outro período grátis.
 */
export function canUseFreeDaysCoupon(
  sub: { status?: string | null; current_period_start?: string | null } | null | undefined
): boolean {
  if (!sub) return true;
  if (sub.current_period_start) return false;
  return !sub.status || sub.status === 'PENDING_PAYMENT';
}

/**
 * PIX: 5% off no valor base (antes ou depois do cupom — aplicamos cupom primeiro, depois PIX).
 * `basePrice`, quando informado, sobrepõe o valor padrão de planLimits.ts — use o preço vigente
 * de lib/planPricing.ts (editável no /interno) em vez do fallback estático sempre que possível.
 */
export function computeSubscriptionPrice(input: {
  planTier: string;
  paymentMethod: 'PIX' | 'CREDIT_CARD';
  coupon?: Pick<CouponRow, 'code' | 'percent_off' | 'amount_off_brl' | 'free_days' | 'discount_months'> | null;
  basePrice?: number;
}): PriceBreakdown {
  const planTier = normalizePlanTier(input.planTier);
  const listPrice = input.basePrice ?? getPlanPrice(planTier);
  let price = listPrice;
  let couponPercent = 0;
  let couponAmount = 0;
  let couponCode: string | null = null;
  const freeDays = couponFreeDays(input.coupon);
  const discountMonths = introDiscountMonths(input.coupon);

  if (input.coupon) {
    couponCode = input.coupon.code.toUpperCase();
    if (freeDays > 0 && discountMonths > 0 && input.coupon.percent_off && input.coupon.percent_off > 0) {
      // Desconto de entrada: dias grátis e depois X% nas primeiras mensalidades.
      couponPercent = Number(input.coupon.percent_off);
      price = price * (1 - couponPercent / 100);
    } else if (freeDays > 0) {
      // Dias grátis: o valor da mensalidade não muda.
    } else if (input.coupon.percent_off && input.coupon.percent_off > 0) {
      couponPercent = Number(input.coupon.percent_off);
      price = price * (1 - couponPercent / 100);
    } else if (input.coupon.amount_off_brl && input.coupon.amount_off_brl > 0) {
      couponAmount = Number(input.coupon.amount_off_brl);
      price = Math.max(0, price - couponAmount);
    }
  }

  const pixDiscountPercent = input.paymentMethod === 'PIX' ? 5 : 0;
  const pixFactor = 1 - pixDiscountPercent / 100;
  price = price * pixFactor;
  const finalPrice = Math.round(price * 100) / 100;

  return {
    planTier,
    listPrice,
    pixDiscountPercent,
    couponCode,
    couponPercent,
    couponAmount,
    freeDays,
    finalPrice,
    discountMonths: couponPercent > 0 && discountMonths > 0 ? discountMonths : 0,
    fullPrice: couponPercent > 0 && discountMonths > 0 ? Math.round(listPrice * pixFactor * 100) / 100 : finalPrice,
  };
}

/** Mensalidades com desconto de entrada (1 a 12) ou 0. */
export function introDiscountMonths(coupon: Pick<CouponRow, 'discount_months'> | null | undefined): number {
  const n = Math.floor(Number(coupon?.discount_months || 0));
  return n >= 1 && n <= 12 ? n : 0;
}

const brlText = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** Frase do cupom para o cliente ("15 dias grátis, depois R$ 75/mês nos 2 primeiros meses e R$ 150/mês depois"). */
export function couponSummaryText(price: PriceBreakdown): string {
  const after = price.discountMonths
    ? `${brlText(price.finalPrice)}/mês nos ${price.discountMonths === 1 ? 'primeiro mês' : `${price.discountMonths} primeiros meses`} e ${brlText(price.fullPrice)}/mês depois`
    : `${brlText(price.finalPrice)}/mês`;
  return price.freeDays ? `${price.freeDays} dias grátis, depois ${after}` : after;
}

/** Linha de public.subscriptions com o desconto de entrada. */
export type IntroDiscountRow = {
  asaas_subscription_id?: string | null;
  intro_discount_payments_left?: number | null;
  intro_full_price_brl?: number | string | null;
  intro_last_payment_id?: string | null;
};

/**
 * O que fazer quando uma mensalidade é paga: conta mais uma com desconto e,
 * na última, manda voltar ao preço cheio. Reentrega do mesmo pagamento e
 * pagamento de outra assinatura não contam.
 */
export function nextIntroDiscountStep(
  row: IntroDiscountRow | null | undefined,
  paymentId: string,
  paymentSubscriptionId: string | null
): { action: 'none' } | { action: 'count'; left: number } | { action: 'restore'; fullPrice: number } {
  const left = Number(row?.intro_discount_payments_left || 0);
  if (!row || left <= 0) return { action: 'none' };
  if (row.intro_last_payment_id === paymentId) return { action: 'none' };
  if (paymentSubscriptionId && row.asaas_subscription_id && paymentSubscriptionId !== row.asaas_subscription_id) return { action: 'none' };
  if (left > 1) return { action: 'count', left: left - 1 };
  const fullPrice = Number(row.intro_full_price_brl);
  return Number.isFinite(fullPrice) && fullPrice > 0 ? { action: 'restore', fullPrice } : { action: 'none' };
}

const isMissingColumn = (error: { code?: string; message?: string } | null) =>
  Boolean(error && (error.code === '42703' || error.code === 'PGRST204' || /intro_/.test(error.message || '')));

/** Grava na assinatura o desconto de entrada do cupom (depois do checkout com dias grátis). */
export async function saveIntroDiscount(tenantId: string, price: PriceBreakdown): Promise<void> {
  if (!price.discountMonths) return;
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      intro_discount_payments_left: price.discountMonths,
      intro_full_price_brl: price.fullPrice,
      intro_last_payment_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);
  if (error) {
    // Sem a migration o desconto valeria para sempre: avisa alto para rodar.
    console.error('[billing] desconto de entrada não gravado (rode 20261124_intro_discount.sql):', error.message);
  }
}

/**
 * Mensalidade paga: conta o desconto de entrada e, depois da última com
 * desconto, volta a assinatura para o preço cheio na Asaas (as cobranças já
 * geradas para frente também) e avisa o cliente. Nunca derruba o webhook.
 */
export async function countIntroDiscountPayment(tenantId: string, paymentId: string, paymentSubscriptionId: string | null): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('asaas_subscription_id, intro_discount_payments_left, intro_full_price_brl, intro_last_payment_id')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) {
    if (!isMissingColumn(error)) console.error('[billing] desconto de entrada:', error.message);
    return;
  }
  const row = data as IntroDiscountRow | null;
  const step = nextIntroDiscountStep(row, paymentId, paymentSubscriptionId);
  if (step.action === 'none') return;
  const now = new Date().toISOString();
  if (step.action === 'count') {
    await supabaseAdmin
      .from('subscriptions')
      .update({ intro_discount_payments_left: step.left, intro_last_payment_id: paymentId, updated_at: now })
      .eq('tenant_id', tenantId);
    return;
  }
  const { asaasUpdateSubscriptionValue, isBillingMockEnabled } = await import('@/lib/asaasClient');
  if (!isBillingMockEnabled() && row?.asaas_subscription_id) {
    await asaasUpdateSubscriptionValue(row.asaas_subscription_id, step.fullPrice, { updatePendingPayments: true });
  }
  await supabaseAdmin
    .from('subscriptions')
    .update({
      monthly_price_brl: step.fullPrice,
      intro_discount_payments_left: 0,
      intro_last_payment_id: paymentId,
      updated_at: now,
    })
    .eq('tenant_id', tenantId);
  await notifyTenantAdmins(tenantId, {
    title: 'Seu desconto de entrada terminou',
    message: `Obrigado por continuar com a Domu! A partir da próxima mensalidade o valor volta para ${brlText(step.fullPrice)}/mês.`,
    type: 'INFO',
    url: '/assinatura',
  });
}

/**
 * Novo valor de um assinante quando o preço de TABELA do plano muda.
 *
 * O assinante não paga o preço de tabela: paga com PIX (-5%), cupom, ou é
 * cortesia (R$ 0). Por isso o reajuste é proporcional ao da tabela — quem
 * paga 187,15 (197 no PIX) e a tabela vai de 197 → 247 passa a pagar 234,65,
 * mantendo o desconto. Cortesia/cupom de 100% (valor 0) nunca é reajustado.
 *
 * `currentPrice` deve ser o valor de referência mais recente do assinante:
 * o de um reajuste ainda pendente, se houver, senão o que ele paga hoje.
 * Retorna null quando não há nada a fazer.
 */
export function adjustSubscriptionPrice(
  currentPrice: number,
  oldTablePrice: number,
  newTablePrice: number
): number | null {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;
  if (!Number.isFinite(oldTablePrice) || oldTablePrice <= 0) return null;
  if (!Number.isFinite(newTablePrice) || newTablePrice <= 0) return null;
  if (oldTablePrice === newTablePrice) return null;
  const next = Math.round(currentPrice * (newTablePrice / oldTablePrice) * 100) / 100;
  return next === currentPrice ? null : next;
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
  /** Duração do período (padrão 30 dias; cupom de dias grátis usa os dias dele). */
  periodDays?: number;
}) {
  const planTier = normalizePlanTier(input.planTier);
  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + (input.periodDays || 30) * 24 * 60 * 60 * 1000);
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

    // Plano ativo (ou ramo novo no upgrade): cria na Meta os modelos do ramo,
    // se o WhatsApp já estiver conectado. Depois da resposta, sem atrasar o pagamento.
    const tenantId = input.tenantId;
    const provision = () =>
      import('@/lib/segmentTemplates')
        .then((m) => m.provisionSegmentTemplates(tenantId))
        .catch((err) => console.warn('[billing] modelos do ramo:', err instanceof Error ? err.message : err));
    try {
      after(provision);
    } catch {
      void provision();
    }
  }

  // Aviso de venda para a Domu: começou o teste grátis ou pagou (renovação não avisa).
  const salesEvent =
    status === 'ACTIVE' && !wasAlreadyActive ? 'PAID' : status === 'TRIAL' && previousSub?.status !== 'TRIAL' ? 'TRIAL' : null;
  if (salesEvent) {
    const tenantId = input.tenantId;
    const extra = { planTier, price: input.monthlyPrice };
    const notifySale = () =>
      import('@/lib/salesAgent')
        .then((m) => m.notifySalesEvent(salesEvent, tenantId, extra))
        .catch((err) => console.warn('[billing] aviso de venda:', err instanceof Error ? err.message : err));
    try {
      after(notifySale);
    } catch {
      void notifySale();
    }
  }

  if (status === 'ACTIVE' && !wasAlreadyActive) {
    await notifyTenantAdmins(input.tenantId, {
      title: 'Assinatura ativada',
      message: `Seu plano ${planTier} está ativo. Bom disparo!`,
      type: 'SUCCESS',
    });
  }

  if (input.couponCode && (status === 'ACTIVE' || status === 'TRIAL')) {
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
  current_period_start?: string | null;
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
    // Cupom só conta na primeira ativação (ou no início dos dias grátis), não em renovação.
    couponCode: isActiveSubscription(sub) ? null : sub?.coupon_code || null,
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
    Number(asaasSub.value) || Number(sub?.monthly_price_brl) || (await getTenantPlanPrice(tenantId, planTier));
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
