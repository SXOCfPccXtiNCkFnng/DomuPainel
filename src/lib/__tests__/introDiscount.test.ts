import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseServer', () => ({ supabaseAdmin: {} }));

import { computeSubscriptionPrice, couponSummaryText, nextIntroDiscountStep } from '../billing';
import { withSalesPromo } from '../prospectRules';

const black = { code: 'BLACK50', percent_off: 50, amount_off_brl: null, free_days: 15, discount_months: 2 };

describe('desconto de entrada (15 dias grátis + 50% nos 2 primeiros meses)', () => {
  it('cartão: R$ 150 vira R$ 75 nas 2 primeiras e volta a R$ 150', () => {
    const p = computeSubscriptionPrice({ planTier: 'STARTER', paymentMethod: 'CREDIT_CARD', coupon: black, basePrice: 150 });
    expect(p.freeDays).toBe(15);
    expect(p.finalPrice).toBe(75);
    expect(p.discountMonths).toBe(2);
    expect(p.fullPrice).toBe(150);
    expect(couponSummaryText(p)).toBe('15 dias grátis, depois R$ 75/mês nos 2 primeiros meses e R$ 150/mês depois');
  });

  it('PIX: os 5% valem no desconto e no preço cheio', () => {
    const p = computeSubscriptionPrice({ planTier: 'PRO', paymentMethod: 'PIX', coupon: black, basePrice: 297 });
    expect(p.finalPrice).toBe(141.07);
    expect(p.fullPrice).toBe(282.15);
  });

  it('cupom só de dias grátis continua igual (sem desconto e sem volta de preço)', () => {
    const p = computeSubscriptionPrice({
      planTier: 'STARTER',
      paymentMethod: 'CREDIT_CARD',
      coupon: { code: 'DOMU15', percent_off: null, amount_off_brl: null, free_days: 15, discount_months: null },
      basePrice: 150,
    });
    expect(p.finalPrice).toBe(150);
    expect(p.discountMonths).toBe(0);
    expect(p.fullPrice).toBe(150);
  });

  it('cupom antigo de % (sem meses) continua valendo do jeito de antes', () => {
    const p = computeSubscriptionPrice({
      planTier: 'STARTER',
      paymentMethod: 'CREDIT_CARD',
      coupon: { code: 'OFF20', percent_off: 20, amount_off_brl: null, free_days: null, discount_months: null },
      basePrice: 150,
    });
    expect(p.finalPrice).toBe(120);
    expect(p.discountMonths).toBe(0);
  });
});

describe('contagem das mensalidades com desconto (webhook de pagamento)', () => {
  const row = { asaas_subscription_id: 'sub_1', intro_discount_payments_left: 2, intro_full_price_brl: 150, intro_last_payment_id: null };

  it('1ª mensalidade paga: conta, ainda falta 1', () => {
    expect(nextIntroDiscountStep(row, 'pay_1', 'sub_1')).toEqual({ action: 'count', left: 1 });
  });

  it('2ª mensalidade paga: volta ao preço cheio', () => {
    expect(nextIntroDiscountStep({ ...row, intro_discount_payments_left: 1, intro_last_payment_id: 'pay_1' }, 'pay_2', 'sub_1')).toEqual({
      action: 'restore',
      fullPrice: 150,
    });
  });

  it('a Asaas reenviou o mesmo pagamento: não conta duas vezes', () => {
    expect(nextIntroDiscountStep({ ...row, intro_discount_payments_left: 1, intro_last_payment_id: 'pay_1' }, 'pay_1', 'sub_1')).toEqual({
      action: 'none',
    });
  });

  it('pagamento de outra assinatura ou sem desconto pendente: nada muda', () => {
    expect(nextIntroDiscountStep(row, 'pay_9', 'sub_antiga')).toEqual({ action: 'none' });
    expect(nextIntroDiscountStep({ ...row, intro_discount_payments_left: 0 }, 'pay_3', 'sub_1')).toEqual({ action: 'none' });
    expect(nextIntroDiscountStep(null, 'pay_3', 'sub_1')).toEqual({ action: 'none' });
  });
});

describe('linha da Black Friday na abordagem', () => {
  const msg = 'Oi, tudo bem? Sou a Helena, da Domu. A gente tem uma atendente virtual. Posso te mostrar como funcionaria aí com vocês?';

  it('entra antes da pergunta final enquanto a campanha vale', () => {
    const out = withSalesPromo(msg, new Date('2026-12-07T23:00:00Z')); // 7/12, 20h em Brasília
    expect(out).toContain('Black Friday');
    expect(out.trim().endsWith('Posso te mostrar como funcionaria aí com vocês?')).toBe(true);
  });

  it('some depois do último dia', () => {
    expect(withSalesPromo(msg, new Date('2026-12-08T04:00:00Z'))).toBe(msg); // 8/12, 1h em Brasília
  });
});
