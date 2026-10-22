import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseServer', () => ({ supabaseAdmin: {} }));

import {
  canUseFreeDaysCoupon,
  computeSubscriptionPrice,
  couponFreeDays,
  isActiveSubscription,
  resolvePaidPlan,
  type SubscriptionRow,
} from '../billing';

const activeStarterWithPendingPro: SubscriptionRow = {
  status: 'ACTIVE',
  plan_tier: 'STARTER',
  monthly_price_brl: 197,
  payment_method: 'PIX',
  asaas_subscription_id: 'sub_old',
  coupon_code: 'BEMVINDO',
  pending_plan_tier: 'PRO',
  pending_monthly_price_brl: 472.15,
  pending_payment_method: 'CREDIT_CARD',
  pending_asaas_subscription_id: 'sub_new',
};

describe('troca de plano (resolvePaidPlan)', () => {
  it('pagamento da assinatura nova efetiva a troca pendente', () => {
    const plan = resolvePaidPlan(activeStarterWithPendingPro, 'sub_new');
    expect(plan).toMatchObject({
      planTier: 'PRO',
      monthlyPrice: 472.15,
      paymentMethod: 'CREDIT_CARD',
      asaasSubscriptionId: 'sub_new',
      isPlanChange: true,
    });
  });

  it('pagamento da assinatura atual é só renovação — não troca de plano', () => {
    const plan = resolvePaidPlan(activeStarterWithPendingPro, 'sub_old');
    expect(plan).toMatchObject({
      planTier: 'STARTER',
      monthlyPrice: 197,
      asaasSubscriptionId: 'sub_old',
      isPlanChange: false,
      // cupom não conta de novo em renovação
      couponCode: null,
    });
  });

  it('primeira contratação (sem pendência) ativa o plano gravado', () => {
    const plan = resolvePaidPlan(
      { status: 'PENDING_PAYMENT', plan_tier: 'PRO', monthly_price_brl: 497, coupon_code: 'X' },
      'sub_1'
    );
    expect(plan).toMatchObject({ planTier: 'PRO', isPlanChange: false, couponCode: 'X' });
  });

  it('conta ativa vira troca pendente; inativa vira contratação nova', () => {
    expect(isActiveSubscription({ status: 'ACTIVE' })).toBe(true);
    expect(isActiveSubscription({ status: 'TRIAL' })).toBe(true);
    expect(isActiveSubscription({ status: 'PAST_DUE' })).toBe(false);
    expect(isActiveSubscription(null)).toBe(false);
  });

  it('primeiro pagamento depois dos dias grátis não conta o cupom de novo', () => {
    const plan = resolvePaidPlan(
      { status: 'TRIAL', plan_tier: 'PRO', monthly_price_brl: 497, coupon_code: 'TESTE15', asaas_subscription_id: 'sub_t' },
      'sub_t'
    );
    expect(plan).toMatchObject({ planTier: 'PRO', monthlyPrice: 497, isPlanChange: false, couponCode: null });
  });
});

describe('cupom de dias grátis', () => {
  const coupon = { code: 'teste15', percent_off: null, amount_off_brl: null, free_days: 15 };

  it('não mexe no valor da mensalidade e informa os dias', () => {
    const price = computeSubscriptionPrice({ planTier: 'PRO', paymentMethod: 'CREDIT_CARD', coupon, basePrice: 497 });
    expect(price).toMatchObject({ freeDays: 15, finalPrice: 497, couponCode: 'TESTE15', couponPercent: 0 });
  });

  it('dias grátis prevalecem se o cupom também tiver % cadastrado', () => {
    const price = computeSubscriptionPrice({
      planTier: 'PRO',
      paymentMethod: 'CREDIT_CARD',
      coupon: { ...coupon, percent_off: 100 },
      basePrice: 497,
    });
    expect(price.finalPrice).toBe(497);
  });

  it('cupom comum continua sem dias grátis', () => {
    const price = computeSubscriptionPrice({
      planTier: 'PRO',
      paymentMethod: 'CREDIT_CARD',
      coupon: { code: 'X', percent_off: 20, amount_off_brl: null },
      basePrice: 100,
    });
    expect(price).toMatchObject({ freeDays: 0, finalPrice: 80 });
  });

  it('couponFreeDays ignora valores inválidos', () => {
    expect(couponFreeDays({ free_days: 0 })).toBe(0);
    expect(couponFreeDays({ free_days: 400 })).toBe(0);
    expect(couponFreeDays({ free_days: 7.9 })).toBe(7);
    expect(couponFreeDays(null)).toBe(0);
  });

  it('só vale para quem nunca teve plano', () => {
    expect(canUseFreeDaysCoupon(null)).toBe(true);
    expect(canUseFreeDaysCoupon({ status: 'PENDING_PAYMENT' })).toBe(true);
    expect(canUseFreeDaysCoupon({ status: 'PENDING_PAYMENT', current_period_start: '2026-01-01' })).toBe(false);
    expect(canUseFreeDaysCoupon({ status: 'TRIAL' })).toBe(false);
    expect(canUseFreeDaysCoupon({ status: 'ACTIVE' })).toBe(false);
    expect(canUseFreeDaysCoupon({ status: 'CANCELED' })).toBe(false);
  });
});
