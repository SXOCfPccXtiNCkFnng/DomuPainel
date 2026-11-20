import { describe, expect, it } from 'vitest';
import {
  canMoveTo,
  computeOrderMetrics,
  DEFAULT_PIZZERIA_SETTINGS,
  deliveryFeeFor,
  improvementTips,
  isOpenAt,
  menuItemFromRow,
  nextStatus,
  orderFromRow,
  ordersAsFinance,
  priceOrder,
  statusMessage,
  validateMenuItemInput,
  validatePizzeriaSettings,
  type MenuItem,
  type Order,
  type PizzeriaSettings,
} from '../pizzeria';
import { buildPizzeriaSystemPrompt, menuForPrompt } from '../pizzeriaPrompt';
import { pizzeriaToolDeclarations } from '../pizzeriaTools';
import { DEFAULT_ASSISTANT_SETTINGS } from '../assistantPrompt';
import { fallbackReplyForEffects } from '../assistantRules';
import { assistantVertical } from '../assistantRunner';
import { getNavSectionsForSegment } from '../segmentConfig';
import { planFeatures } from '../planFeatures';
import { segmentTemplateDefs } from '../segmentTemplates';
import { fallbackTips, summaryHeadline, type WeeklyMetrics } from '../weeklyInsightsRules';

const item = (id: string, name: string, category: string, prices: { size: string; price: number }[], allows_half = true): MenuItem =>
  menuItemFromRow({ id, name, category, prices, allows_half, active: true });

const menu: MenuItem[] = [
  item('1', 'Calabresa', 'Pizzas', [
    { size: 'Broto', price: 35 },
    { size: 'Grande', price: 55 },
  ]),
  item('2', 'Portuguesa', 'Pizzas', [
    { size: 'Broto', price: 38 },
    { size: 'Grande', price: 62 },
  ]),
  item('3', 'Coca-Cola 2L', 'Bebidas', [{ size: '', price: 14 }], false),
  item('4', 'Especial da casa', 'Pizzas', [{ size: 'Grande', price: 80 }], false),
];

const settings: PizzeriaSettings = { ...DEFAULT_PIZZERIA_SETTINGS, delivery_fee: 6 };

describe('cardápio', () => {
  it('valida item com tamanhos', () => {
    const r = validateMenuItemInput({ name: 'Calabresa', category: 'Pizzas', prices: [{ size: 'Grande', price: '55,90' }], allows_half: true });
    expect(r.ok && r.fields.prices[0].price).toBe(55.9);
  });
  it('exige nome do tamanho quando há mais de um preço', () => {
    const r = validateMenuItemInput({ name: 'X', category: 'Pizzas', prices: [{ size: '', price: 10 }, { size: 'G', price: 20 }] });
    expect(r.ok).toBe(false);
  });
  it('recusa categoria desconhecida e preço zero', () => {
    expect(validateMenuItemInput({ name: 'X', category: 'Carros', prices: [{ price: 10 }] }).ok).toBe(false);
    expect(validateMenuItemInput({ name: 'X', category: 'Bebidas', prices: [{ price: 0 }] }).ok).toBe(false);
  });
});

describe('cálculo do pedido (nunca pela IA)', () => {
  it('soma itens e taxa única de entrega', () => {
    const r = priceOrder({
      menu,
      settings,
      fulfillment: 'ENTREGA',
      area: 'Centro',
      items: [
        { item: 'calabresa', tamanho: 'grande', quantidade: 2 },
        { item: 'coca cola 2l' },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.order.subtotal).toBe(124);
    expect(r.order.delivery_fee).toBe(6);
    expect(r.order.total).toBe(130);
  });
  it('meio a meio cobra o sabor mais caro por padrão', () => {
    const r = priceOrder({ menu, settings, fulfillment: 'RETIRADA', items: [{ sabores: ['Calabresa', 'Portuguesa'], tamanho: 'Grande' }] });
    expect(r.ok && r.order.total).toBe(62);
    expect(r.ok && r.order.lines[0].description).toContain('meio Calabresa / meio Portuguesa');
  });
  it('meio a meio pela média quando configurado', () => {
    const r = priceOrder({ menu, settings: { ...settings, half_half_rule: 'MEDIA' }, fulfillment: 'RETIRADA', items: [{ sabores: ['Calabresa', 'Portuguesa'], tamanho: 'Grande' }] });
    expect(r.ok && r.order.total).toBe(58.5);
  });
  it('recusa sabor que não vai em meio a meio, sabor inexistente e falta de tamanho', () => {
    expect(priceOrder({ menu, settings, fulfillment: 'RETIRADA', items: [{ sabores: ['Calabresa', 'Especial da casa'], tamanho: 'Grande' }] }).ok).toBe(false);
    expect(priceOrder({ menu, settings, fulfillment: 'RETIRADA', items: [{ item: 'Strogonoff', tamanho: 'Grande' }] }).ok).toBe(false);
    expect(priceOrder({ menu, settings, fulfillment: 'RETIRADA', items: [{ item: 'Calabresa' }] }).ok).toBe(false);
  });
  it('respeita taxa por bairro e pedido mínimo', () => {
    const s = { ...settings, delivery_areas: [{ area: 'Jardim América', fee: 8 }], min_order: 40 };
    expect(priceOrder({ menu, settings: s, fulfillment: 'ENTREGA', area: 'Centro', items: [{ item: 'Calabresa', tamanho: 'Grande' }] }).ok).toBe(false);
    const ok = priceOrder({ menu, settings: s, fulfillment: 'ENTREGA', area: 'jardim america', items: [{ item: 'Calabresa', tamanho: 'Grande' }] });
    expect(ok.ok && ok.order.delivery_fee).toBe(8);
    expect(priceOrder({ menu, settings: s, fulfillment: 'RETIRADA', items: [{ item: 'Calabresa', tamanho: 'Broto' }] }).ok).toBe(false);
    expect(deliveryFeeFor(s, 'Bairro X')).toBeNull();
  });
});

describe('horário', () => {
  // 2026-11-21 é sábado. 23h de Brasília = 02h UTC do dia 22.
  const hours = DEFAULT_PIZZERIA_SETTINGS.weekly_hours.map((d) => ({ ...d, close: '00:30' }));
  it('aberto à noite e depois da meia-noite quando fecha 00:30', () => {
    expect(isOpenAt(new Date('2026-11-22T02:00:00Z'), hours)).toBe(true); // sáb 23h
    expect(isOpenAt(new Date('2026-11-22T03:15:00Z'), hours)).toBe(true); // dom 00h15 (resto de sábado)
    expect(isOpenAt(new Date('2026-11-22T04:00:00Z'), hours)).toBe(false); // dom 01h
    expect(isOpenAt(new Date('2026-11-21T15:00:00Z'), hours)).toBe(false); // sáb 12h
  });
  it('valida configuração', () => {
    expect(validatePizzeriaSettings({ ...DEFAULT_PIZZERIA_SETTINGS, delivery_enabled: false, pickup_enabled: false }).ok).toBe(false);
    expect(validatePizzeriaSettings({ ...DEFAULT_PIZZERIA_SETTINGS, max_flavors: 9 }).ok).toBe(false);
    expect(validatePizzeriaSettings({ ...DEFAULT_PIZZERIA_SETTINGS }).ok).toBe(true);
  });
});

describe('status', () => {
  it('segue o fluxo da entrega e da retirada', () => {
    expect(nextStatus('NOVO', 'ENTREGA')).toBe('EM_PREPARO');
    expect(nextStatus('EM_PREPARO', 'ENTREGA')).toBe('SAIU_ENTREGA');
    expect(nextStatus('EM_PREPARO', 'RETIRADA')).toBe('PRONTO_RETIRADA');
    expect(canMoveTo('EM_PREPARO', 'NOVO', 'ENTREGA')).toBe(false);
    expect(canMoveTo('ENTREGUE', 'CANCELADO', 'ENTREGA')).toBe(false);
    expect(canMoveTo('NOVO', 'ENTREGUE', 'RETIRADA')).toBe(true);
    expect(canMoveTo('NOVO', 'SAIU_ENTREGA', 'RETIRADA')).toBe(false);
  });
  it('monta a mensagem para o cliente', () => {
    const msg = statusMessage({ status: 'SAIU_ENTREGA', orderNumber: 12, customerName: 'Ana Souza', fulfillment: 'ENTREGA', etaMinutes: 40, companyName: 'Forno' });
    expect(msg).toContain('Ana');
    expect(msg).toContain('#12');
    expect(statusMessage({ status: 'NOVO', orderNumber: 1, customerName: 'A', fulfillment: 'ENTREGA', etaMinutes: 40, companyName: 'F' })).toBeNull();
  });
});

const NOW = new Date('2026-11-20T23:00:00Z');
const order = (n: number, daysAgo: number, patch: Partial<Order> = {}): Order =>
  orderFromRow({
    id: String(n),
    order_number: n,
    customer_name: `Cliente ${n % 4}`,
    customer_phone: `5511999990${String(n % 4).padStart(3, '0')}`,
    lead_id: `lead-${n % 4}`,
    items: [{ description: 'Pizza Calabresa (Grande)', flavors: ['Calabresa'], category: 'Pizzas', quantity: 1, unit_price: 55, total: 55, size: 'Grande', notes: null }],
    total: 61,
    delivery_fee: 6,
    status: 'ENTREGUE',
    fulfillment: 'ENTREGA',
    source: 'WHATSAPP',
    created_at: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    ...patch,
  });

describe('métricas', () => {
  it('soma faturamento, ticket, cancelamentos e sumidos', () => {
    const orders = [
      order(1, 1),
      order(2, 2),
      order(3, 3, { status: 'CANCELADO' }),
      order(4, 2, { source: 'PANEL', fulfillment: 'RETIRADA' }),
      order(5, 50, { customer_phone: '5511988887777', customer_name: 'Sumido', lead_id: 'lead-x' }),
    ];
    const m = computeOrderMetrics(orders, NOW, 7);
    expect(m.orders).toBe(3);
    expect(m.revenue).toBe(183);
    expect(m.averageTicket).toBe(61);
    expect(m.cancelled).toBe(1);
    expect(m.byWhatsApp).toBe(2);
    expect(m.pickup).toBe(1);
    expect(m.topItems[0].name).toBe('Calabresa');
    expect(m.lapsed.leadIds).toContain('lead-x');
    expect(m.daily).toHaveLength(7);
  });
  it('dicas de melhoria apontam cardápio vazio e sumidos', () => {
    const m = computeOrderMetrics([], NOW, 30);
    expect(improvementTips(m, { assistantEnabled: false, menuItems: 0 })[0].href).toBe('/cardapio');
  });
  it('vira o formato do Financeiro', () => {
    const f = ordersAsFinance([order(1, 1), order(2, 1, { status: 'NOVO' }), order(3, 1, { status: 'CANCELADO' })]);
    expect(f.map((x) => x.status)).toEqual(['COMPLETED', 'CONFIRMED', 'CANCELLED']);
  });
});

describe('atendente e módulo', () => {
  it('alimentacao tem atendente de pizzaria e menu próprio', () => {
    expect(assistantVertical('alimentacao')).toBe('pizzaria');
    const hrefs = getNavSectionsForSegment('alimentacao').flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toEqual(expect.arrayContaining(['/pedidos', '/cardapio', '/vendas', '/atendente', '/disparos', '/dicas', '/financeiro']));
  });
  it('prompt traz cardápio, situação e regra de não somar', () => {
    const prompt = buildPizzeriaSystemPrompt({
      settings: { ...DEFAULT_ASSISTANT_SETTINGS, enabled: true },
      companyName: 'Forno de Pedra',
      menu,
      pizzeria: settings,
      now: new Date('2026-11-22T02:00:00Z'),
    });
    expect(prompt).toContain('Calabresa');
    expect(prompt).toContain('ABERTA');
    expect(prompt).toContain('calcular_pedido');
    expect(menuForPrompt(menu, false)).not.toContain('R$');
  });
  it('declara as ferramentas de pedido', () => {
    expect(pizzeriaToolDeclarations().map((d) => d.name)).toEqual(['ver_cardapio', 'calcular_pedido', 'registrar_pedido', 'status_pedido', 'chamar_equipe']);
  });
  it('resposta de segurança quando a IA registrou e não escreveu', () => {
    const text = fallbackReplyForEffects({ booked: [], visits: [], orders: [{ numero: 7, total: 'R$ 61,00' }], cancelled: 0, handoff: false });
    expect(text).toContain('#7');
  });
  it('plano, modelos e dicas falam de pedidos', () => {
    expect(planFeatures('alimentacao', 'STARTER').join(' ')).toContain('pedido');
    expect(segmentTemplateDefs('alimentacao').map((d) => d.name)).toContain('retorno_cliente_pizza');
    const m = { kind: 'pedidos', revenue: 100, done: 2, revenueChangePct: null, lapsed: { count: 0, sample: [], leadIds: [] }, weekdays: [], topServices: [], cancelled: 0, assistant: { enabled: true }, messages: { inbound: 0 }, expenses: 0, otherIncome: 0 } as unknown as WeeklyMetrics;
    expect(summaryHeadline(m)).toContain('2 pedidos');
    expect(fallbackTips(m)[0].action).toBe('PEDIDOS');
  });
});
