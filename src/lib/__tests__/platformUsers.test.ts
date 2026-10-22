import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseServer', () => ({ supabaseAdmin: {} }));

import { paymentStateOf, summarizeUsers, type PlatformUserRow } from '@/lib/platformUsers';

const now = new Date('2026-10-21T12:00:00Z').getTime();
const ago = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

function row(partial: Partial<PlatformUserRow>): PlatformUserRow {
  return {
    userId: Math.random().toString(36),
    name: 'X',
    email: 'x@x.com',
    phone: '',
    role: 'ADMIN',
    createdAt: ago(60),
    lastLoginAt: null,
    tenantId: 't',
    companyName: 'Loja',
    segment: 'geral',
    subscriptionStatus: 'NONE',
    paymentState: 'NONE',
    planTier: null,
    monthlyPrice: null,
    periodEnd: null,
    ...partial,
  };
}

describe('paymentStateOf', () => {
  it('ativa com valor é pagando; sem valor é cortesia', () => {
    expect(paymentStateOf('ACTIVE', 97)).toBe('PAYING');
    expect(paymentStateOf('ACTIVE', 0)).toBe('COURTESY');
    expect(paymentStateOf('ACTIVE', null)).toBe('COURTESY');
  });

  it('demais situações', () => {
    expect(paymentStateOf('TRIAL', 0)).toBe('TRIAL');
    expect(paymentStateOf('PENDING_PAYMENT', 97)).toBe('PENDING');
    expect(paymentStateOf('PAST_DUE', 97)).toBe('PAST_DUE');
    expect(paymentStateOf('CANCELED', 97)).toBe('CANCELED');
    expect(paymentStateOf('NONE', null)).toBe('NONE');
  });
});

describe('summarizeUsers', () => {
  it('conta logins e pagamento', () => {
    const summary = summarizeUsers(
      [
        row({ lastLoginAt: ago(0.1), paymentState: 'PAYING' }),
        row({ lastLoginAt: ago(3), paymentState: 'COURTESY' }),
        row({ lastLoginAt: ago(45), paymentState: 'PAST_DUE' }),
        row({ lastLoginAt: null, paymentState: 'PENDING' }),
        row({ lastLoginAt: ago(10), paymentState: 'TRIAL' }),
      ],
      now
    );
    expect(summary).toEqual({
      total: 5,
      login24h: 1,
      login7d: 2,
      inactive30d: 1,
      neverLogged: 1,
      paying: 1,
      courtesy: 1,
      notPaying: 2,
    });
  });
});
