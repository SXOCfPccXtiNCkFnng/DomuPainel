import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseServer', () => ({ supabaseAdmin: {} }));

import { resolvePlanPrices } from '../planPricing';
import { getPlanPropertyLimit } from '../planLimits';

const defaults = { STARTER: 150, PRO: 297, ENTERPRISE: 597 };
const overrides = {
  imobiliario: { STARTER: 197, PRO: 397 },
  automotivo: { PRO: 247 },
};

describe('resolvePlanPrices', () => {
  it('ramo com preço próprio usa o dele e completa com o padrão', () => {
    expect(resolvePlanPrices(defaults, overrides, { segment: 'imobiliario' })).toEqual({
      STARTER: 197,
      PRO: 397,
      ENTERPRISE: 597,
    });
  });

  it('ramo sem preço próprio usa o padrão', () => {
    expect(resolvePlanPrices(defaults, overrides, { segment: 'saude' })).toEqual(defaults);
    expect(resolvePlanPrices(defaults, overrides, {})).toEqual(defaults);
  });

  it('Somente Disparos: Starter no padrão, upgrade com o preço do ramo de negócio', () => {
    const prices = resolvePlanPrices(defaults, overrides, { segment: 'marketing_apenas', businessSegment: 'imobiliario' });
    expect(prices.STARTER).toBe(150);
    expect(prices.PRO).toBe(397);
    expect(prices.ENTERPRISE).toBe(597);
  });
});

describe('limite de catálogo', () => {
  it('cresce com o plano e conta antiga sem plano fica no Starter', () => {
    expect(getPlanPropertyLimit('STARTER')).toBeLessThan(getPlanPropertyLimit('PRO'));
    expect(getPlanPropertyLimit('PRO')).toBeLessThan(getPlanPropertyLimit('ENTERPRISE'));
    expect(getPlanPropertyLimit(null)).toBe(getPlanPropertyLimit('STARTER'));
  });
});
