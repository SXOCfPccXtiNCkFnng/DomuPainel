import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseServer', () => ({ supabaseAdmin: {} }));

import { buildFunnel, findAtRiskTenants, type TenantFacts } from '@/lib/platformInsights';

const NOW = new Date('2026-10-21T12:00:00Z').getTime();
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString();

function facts(over: Partial<TenantFacts> = {}): TenantFacts {
  return {
    tenantId: Math.random().toString(36).slice(2),
    name: 'Empresa',
    segment: 'geral',
    createdAt: daysAgo(10),
    whatsappConnected: true,
    subscriptionStatus: 'ACTIVE',
    monthlyPrice: 197,
    planTier: 'PRO',
    periodEnd: daysAgo(-20),
    firstSentAt: daysAgo(9),
    lastCampaignAt: daysAgo(1),
    lastLoginAt: daysAgo(1),
    lastAppointmentAt: null,
    contact: { name: 'Ana', email: 'ana@x.com', phone: '11999990000' },
    ...over,
  };
}

describe('buildFunnel', () => {
  it('conta cada etapa só com quem passou pelas anteriores e lista quem parou', () => {
    const list = [
      facts({ name: 'Completa' }),
      facts({ name: 'Sem WhatsApp', whatsappConnected: false, subscriptionStatus: 'PENDING_PAYMENT' as never }),
      facts({ name: 'Sem plano', subscriptionStatus: 'PENDING_PAYMENT' as never, firstSentAt: null }),
      // Disparou sem plano ativo não pode contar na etapa de campanha.
      facts({ name: 'Pulo', subscriptionStatus: 'NONE' }),
      facts({ name: 'Parada', firstSentAt: daysAgo(9), lastCampaignAt: daysAgo(20), lastLoginAt: daysAgo(20) }),
    ];
    const funnel = buildFunnel(list, { now: NOW });
    expect(funnel.map((s) => s.count)).toEqual([5, 4, 2, 2, 1]);
    expect(funnel[1].stuck.map((t) => t.name)).toEqual(['Sem WhatsApp']);
    expect(funnel[2].stuck.map((t) => t.name).sort()).toEqual(['Pulo', 'Sem plano']);
    expect(funnel[4].stuck.map((t) => t.name)).toEqual(['Parada']);
    expect(funnel[4].percentOfTotal).toBe(20);
    expect(funnel[4].percentOfPrevious).toBe(50);
  });

  it('filtra pelo período de cadastro', () => {
    const list = [facts({ createdAt: daysAgo(5) }), facts({ createdAt: daysAgo(60) })];
    expect(buildFunnel(list, { sinceDays: 30, now: NOW })[0].count).toBe(1);
    expect(buildFunnel(list, { sinceDays: null, now: NOW })[0].count).toBe(2);
  });

  it('funil vazio não divide por zero', () => {
    expect(buildFunnel([], { now: NOW }).every((s) => s.count === 0 && s.percentOfTotal === 0)).toBe(true);
  });
});

describe('findAtRiskTenants', () => {
  it('ignora quem usa normalmente, cortesia, trial e quem não paga', () => {
    const list = [
      facts(),
      facts({ monthlyPrice: 0, lastLoginAt: null, lastCampaignAt: null }),
      facts({ subscriptionStatus: 'TRIAL', lastLoginAt: null }),
      facts({ subscriptionStatus: 'CANCELED', lastLoginAt: null }),
    ];
    expect(findAtRiskTenants(list, NOW)).toEqual([]);
  });

  it('marca inatividade, atraso e nunca usou, com os graves primeiro', () => {
    const list = [
      facts({ name: 'Sumida 20d', lastLoginAt: daysAgo(20), lastCampaignAt: daysAgo(20) }),
      facts({ name: 'Atrasada', subscriptionStatus: 'PAST_DUE' }),
      facts({ name: 'Nunca usou', lastLoginAt: null, lastCampaignAt: null, firstSentAt: null }),
    ];
    const risk = findAtRiskTenants(list, NOW);
    expect(risk.map((r) => r.name)).toEqual(['Nunca usou', 'Atrasada', 'Sumida 20d']);
    expect(risk[2].severity).toBe('medium');
    expect(risk[2].reasons.map((r) => r.code)).toEqual(['inactive']);
    expect(risk[0].reasons.map((r) => r.code)).toEqual(['never_used', 'no_campaign']);
  });

  it('detecta quem entra mas parou de disparar, e o vencimento só agrava', () => {
    const stopped = facts({ lastCampaignAt: daysAgo(18), periodEnd: daysAgo(-3) });
    const [r] = findAtRiskTenants([stopped], NOW);
    expect(r.reasons.map((x) => x.code)).toEqual(['campaigns_stopped', 'renewal_soon']);

    expect(findAtRiskTenants([facts({ periodEnd: daysAgo(-2) })], NOW)).toEqual([]);
  });

  it('entre igualmente graves, quem paga mais vem antes', () => {
    const list = [
      facts({ name: 'Barato', monthlyPrice: 97, lastLoginAt: daysAgo(40), lastCampaignAt: daysAgo(40) }),
      facts({ name: 'Caro', monthlyPrice: 497, lastLoginAt: daysAgo(35), lastCampaignAt: daysAgo(35) }),
    ];
    expect(findAtRiskTenants(list, NOW).map((r) => r.name)).toEqual(['Caro', 'Barato']);
  });
});
