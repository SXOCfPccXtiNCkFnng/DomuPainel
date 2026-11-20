import { describe, expect, it } from 'vitest';
import { computeSalesIntelligence, intelligenceForAI, type Sale } from '../salesIntelligence';
import { computeRealEstateDemand } from '../realEstateDemand';
import { propertyFromRow } from '../realEstate';
import {
  getPlanAssistantConversationLimit,
  planHasSalesIntelligence,
  SEGMENT_PLAN_PRICES_BRL,
  PLAN_PRICES_BRL,
} from '../planLimits';
import { resolvePlanPrices } from '../planPricing';
import { planFeatures } from '../planFeatures';

// 2026-11-20 é sexta. Sextas = 20, 13, 6; segundas = 16, 9, 2.
const at = (day: string, hour = 20) => `${day}T${String(hour + 3).padStart(2, '0')}:00:00Z`;
const sale = (day: string, items: string[], customer = 'c1', hour = 20): Sale => ({
  at: at(day, hour),
  customerKey: customer,
  items: items.map((name) => ({ name, quantity: 1, revenue: 30 })),
});

const sales: Sale[] = [
  ...['2026-11-20', '2026-11-13', '2026-11-06'].flatMap((d) => [
    sale(d, ['Calabresa', 'Coca 2L']),
    sale(d, ['Calabresa', 'Coca 2L']),
    sale(d, ['Calabresa']),
  ]),
  ...['2026-11-16', '2026-11-09', '2026-11-02'].flatMap((d) => [sale(d, ['X-Burger']), sale(d, ['X-Burger']), sale(d, ['Calabresa'])]),
];

describe('inteligência de vendas', () => {
  const si = computeSalesIntelligence({
    sales,
    previous: [...Array(10)].map(() => sale('2026-10-20', ['X-Burger'])),
    pairScope: 'pedido',
    unit: 'pedidos',
    campaignHref: '/disparos',
    catalogHref: '/cardapio',
    catalogLabel: 'cardápio',
  });

  it('acha o campeão de cada dia', () => {
    expect(si.topByWeekday[5].item).toBe('Calabresa'); // sexta
    expect(si.topByWeekday[1].item).toBe('X-Burger'); // segunda
    expect(si.weekdayMatrix[0].item).toBe('Calabresa');
  });
  it('acha o que sai junto e sugere combo', () => {
    expect(si.pairs[0]).toMatchObject({ a: 'Calabresa', b: 'Coca 2L', together: 6 });
    expect(si.insights.some((i) => i.kind === 'COMBO')).toBe(true);
  });
  it('aponta destaque do dia e queda', () => {
    expect(si.insights.some((i) => i.kind === 'DESTAQUE_DIA')).toBe(true);
    expect(si.trends.find((t) => t.item === 'X-Burger')?.changePct).toBe(-40);
    expect(intelligenceForAI(si)).toContain('Sexta Calabresa');
  });
  it('agenda: pares pelo histórico do cliente', () => {
    const agenda = computeSalesIntelligence({
      sales: ['a', 'b', 'c', 'd'].flatMap((c) => [sale('2026-11-20', ['Corte'], c), sale('2026-11-13', ['Barba'], c)]),
      pairScope: 'cliente',
      unit: 'atendimentos',
      campaignHref: '/disparos',
      catalogHref: '/servicos',
      catalogLabel: 'serviços',
    });
    expect(agenda.pairs[0].together).toBe(4);
  });
});

describe('inteligência de demanda (imobiliário)', () => {
  it('mostra o que falta no catálogo', () => {
    const leads = [...Array(4)].map((_, i) => ({
      interest_purpose: 'VENDA',
      interest_property_type: 'Casa',
      region: 'Centro',
      budget_max: 400000,
      status: i === 0 ? 'VISITA_AGENDADA' : 'NOVO',
      created_at: at('2026-11-20'),
    }));
    const props = [propertyFromRow({ id: '1', code: 'AP', title: 'Apto', type: 'Apartamento', purpose: 'VENDA', status: 'Disponível', price: 300000, neighborhood: 'Centro' })];
    const d = computeRealEstateDemand(leads, props);
    expect(d.gaps[0]).toMatchObject({ type: 'Casa', region: 'Centro', leads: 4 });
    expect(d.insights[0].title).toContain('Falta casa');
  });
});

describe('planos e preços por módulo', () => {
  it('inteligência só no Pro para cima', () => {
    expect(planHasSalesIntelligence('STARTER')).toBe(false);
    expect(planHasSalesIntelligence('PRO')).toBe(true);
    expect(planFeatures('saude', 'STARTER').join(' ')).not.toContain('Inteligência');
    expect(planFeatures('saude', 'PRO').join(' ')).toContain('Inteligência de vendas');
    expect(planFeatures('alimentacao', 'ENTERPRISE').join(' ')).toContain('Inteligência de vendas');
    expect(planFeatures('imobiliario', 'PRO').join(' ')).toContain('Inteligência de demanda');
  });
  it('delivery tem cota maior de conversas', () => {
    expect(getPlanAssistantConversationLimit('STARTER', 'alimentacao')).toBe(250);
    expect(getPlanAssistantConversationLimit('STARTER', 'saude')).toBe(150);
    expect(planFeatures('alimentacao', 'PRO').join(' ')).toContain('700 conversas');
  });
  it('preço padrão de cada módulo, com o do banco por cima', () => {
    expect(resolvePlanPrices(PLAN_PRICES_BRL, SEGMENT_PLAN_PRICES_BRL, { segment: 'alimentacao' }).PRO).toBe(447);
    expect(resolvePlanPrices(PLAN_PRICES_BRL, SEGMENT_PLAN_PRICES_BRL, { segment: 'marketing_apenas' }).STARTER).toBe(97);
    expect(resolvePlanPrices(PLAN_PRICES_BRL, SEGMENT_PLAN_PRICES_BRL, { segment: 'geral' })).toEqual(PLAN_PRICES_BRL);
  });
});
