import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseServer', () => ({ supabaseAdmin: {} }));

import { isActiveSubscription, resolvePaidPlan, type SubscriptionRow } from '../billing';

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
});
