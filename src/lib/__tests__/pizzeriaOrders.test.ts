/**
 * Atendente do delivery usando as ferramentas de verdade (banco e avisos
 * simulados): o que ela consegue registrar, o que ela é obrigada a perguntar
 * e o que nunca pode acontecer (pedido com loja fechada, duplicado, troco
 * perdido). Mais os casos de borda do cálculo, das etapas e do horário.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createOrder, loadCustomerOrders, notifyTenantAdmins, handOffToTeam } = vi.hoisted(() => ({
  createOrder: vi.fn(),
  loadCustomerOrders: vi.fn(),
  notifyTenantAdmins: vi.fn(),
  handOffToTeam: vi.fn(),
}));

vi.mock('@/lib/pizzeriaServer', () => ({ createOrder, loadCustomerOrders }));
vi.mock('@/lib/notify', () => ({ notifyTenantAdmins }));
vi.mock('@/lib/assistantTools', () => ({ handOffToTeam }));
vi.mock('@/lib/supabaseServer', () => ({ supabaseAdmin: {} }));

import {
  canMoveTo,
  DEFAULT_PIZZERIA_SETTINGS,
  insideServiceWindow,
  isOpenAt,
  menuItemFromRow,
  nextStatus,
  priceOrder,
  statusMessage,
  type MenuItem,
  type PizzeriaSettings,
} from '../pizzeria';
import { executePizzeriaTool, type PizzeriaToolContext } from '../pizzeriaTools';

let seq = 0;
const item = (name: string, category: string, prices: { size: string; price: number }[], allows_half = true, active = true): MenuItem =>
  menuItemFromRow({ id: String(++seq), name, category, prices, allows_half, active });
const pizza = (name: string, broto: number, grande: number) =>
  item(name, 'Pizzas', [
    { size: 'Broto', price: broto },
    { size: 'Grande', price: grande },
  ]);

const menu: MenuItem[] = [
  pizza('Calabresa', 30, 55),
  pizza('Calabresa com Cheddar', 34, 62),
  pizza('Quatro Queijos', 36, 68),
  pizza('Portuguesa', 33, 60),
  item('Coca-Cola Lata', 'Bebidas', [{ size: '', price: 6 }], false),
  pizza('Atum', 35, 64),
];
menu[5].active = false; // saiu do cardápio

const settings: PizzeriaSettings = {
  ...DEFAULT_PIZZERIA_SETTINGS,
  delivery_fee: 0,
  delivery_areas: [
    { area: 'Centro', fee: 5 },
    { area: 'Jardim Bandeirantes', fee: 10 },
  ],
};

// Sexta-feira, 27/11/2026, 20h em Brasília (loja aberta das 18h às 23h30; segunda fechada).
const friday20h = new Date('2026-11-27T23:00:00Z');
const monday20h = new Date('2026-11-23T23:00:00Z');

function ctx(over: Partial<PizzeriaToolContext> = {}): PizzeriaToolContext {
  return {
    tenantId: 't1',
    leadId: 'l1',
    leadPhone: '5511999990000',
    leadName: 'Maria Souza',
    companyName: 'Pizzaria Teste',
    lastCustomerMessage: 'pode mandar',
    now: friday20h,
    menu,
    pizzeria: settings,
    showPrices: true,
    paymentMethods: ['PIX', 'Dinheiro'],
    ...over,
  };
}

const bigOrder = {
  itens: [
    { sabores: ['calabresa', '4 queijos'], tamanho: 'grande', observacao: 'sem cebola' },
    { item: 'coca lata', quantidade: 2 },
  ],
  tipo: 'entrega',
  bairro: 'centro',
  endereco: 'Rua das Flores, 120, apto 3',
  pagamento: 'Dinheiro',
  nome_cliente: 'Maria',
};

beforeEach(() => {
  vi.clearAllMocks();
  loadCustomerOrders.mockResolvedValue([]);
  createOrder.mockImplementation(async (input) => ({
    id: 'o1',
    order_number: 42,
    total: input.priced.total,
    area: input.priced.area,
    fulfillment: input.fulfillment,
  }));
});

describe('ver o cardápio', () => {
  it('busca por nome traz os sabores com preço', async () => {
    const r = (await executePizzeriaTool('ver_cardapio', { busca: 'calabresa' }, ctx())) as { itens: { nome: string; precos?: string }[] };
    expect(r.itens.map((i) => i.nome)).toEqual(['Calabresa', 'Calabresa com Cheddar']);
    expect(r.itens[0].precos).toContain('55');
  });

  it('item que saiu do cardápio não aparece', async () => {
    const r = (await executePizzeriaTool('ver_cardapio', { busca: 'atum' }, ctx())) as { observacao?: string };
    expect(r.observacao).toContain('Nada com esse nome');
  });

  it('sem mostrar preço, só os tamanhos', async () => {
    const r = (await executePizzeriaTool('ver_cardapio', { busca: 'portuguesa' }, ctx({ showPrices: false }))) as { itens: Record<string, unknown>[] };
    expect(r.itens[0].precos).toBeUndefined();
    expect(r.itens[0].tamanhos).toEqual(['Broto', 'Grande']);
  });
});

describe('calcular o pedido', () => {
  it('resumo com itens, taxa e total vindos do cardápio', async () => {
    const r = (await executePizzeriaTool('calcular_pedido', bigOrder, ctx())) as { ok: boolean; resumo: string; total: string };
    expect(r.ok).toBe(true);
    expect(r.resumo).toContain('sem cebola');
    expect(r.resumo).toContain('Taxa de entrega');
    expect(r.total).toContain('85');
  });

  it('sem saber se é entrega ou retirada, pergunta', async () => {
    const r = (await executePizzeriaTool('calcular_pedido', { ...bigOrder, tipo: '' }, ctx())) as { erro: string };
    expect(r.erro).toContain('entrega ou retirada');
  });

  it('entende "delivery" e "vou buscar"', async () => {
    const a = (await executePizzeriaTool('calcular_pedido', { ...bigOrder, tipo: 'delivery' }, ctx())) as { ok: boolean };
    const b = (await executePizzeriaTool('calcular_pedido', { ...bigOrder, tipo: 'vou buscar' }, ctx())) as { ok: boolean; resumo: string };
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(b.resumo).not.toContain('Taxa de entrega');
  });

  it('bairro fora da lista: oferece retirada', async () => {
    const r = (await executePizzeriaTool('calcular_pedido', { ...bigOrder, bairro: 'Bairro Distante' }, ctx())) as { erro: string };
    expect(r.erro).toContain('fora da área');
  });
});

describe('registrar o pedido', () => {
  it('pedido certo vai para a cozinha com o valor do cardápio e avisa a loja', async () => {
    const r = (await executePizzeriaTool('registrar_pedido', { ...bigOrder, troco_para: 100 }, ctx())) as { ok: boolean; pedido: { numero: number } };
    expect(r.ok).toBe(true);
    expect(r.pedido.numero).toBe(42);
    const input = createOrder.mock.calls[0][0];
    expect(input.priced.total).toBe(85);
    expect(input.changeFor).toBe(100);
    expect(input.address).toBe('Rua das Flores, 120, apto 3');
    expect(input.customerPhone).toBe('5511999990000');
    expect(notifyTenantAdmins).toHaveBeenCalledOnce();
    expect(notifyTenantAdmins.mock.calls[0][1].title).toContain('#42');
  });

  it('loja fechada: não registra', async () => {
    const r = (await executePizzeriaTool('registrar_pedido', bigOrder, ctx({ now: monday20h }))) as { ok: boolean; erro: string };
    expect(r.ok).toBe(false);
    expect(r.erro).toContain('fechada');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('entrega sem número no endereço: pede o endereço completo', async () => {
    const r = (await executePizzeriaTool('registrar_pedido', { ...bigOrder, endereco: 'Rua das Flores' }, ctx())) as { erro: string };
    expect(r.erro).toContain('número');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('retirada não precisa de endereço', async () => {
    const r = (await executePizzeriaTool('registrar_pedido', { ...bigOrder, tipo: 'retirada', endereco: '' }, ctx())) as { ok: boolean };
    expect(r.ok).toBe(true);
    expect(createOrder.mock.calls[0][0].address).toBeNull();
    expect(createOrder.mock.calls[0][0].priced.delivery_fee).toBe(0);
  });

  it('troco menor que o total: confirma com o cliente em vez de perder a informação', async () => {
    const r = (await executePizzeriaTool('registrar_pedido', { ...bigOrder, troco_para: 50 }, ctx())) as { erro: string };
    expect(r.erro).toContain('troco');
    expect(r.erro).toContain('85');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('troco escrito errado: pergunta de novo', async () => {
    const r = (await executePizzeriaTool('registrar_pedido', { ...bigOrder, troco_para: 'cem' }, ctx())) as { erro: string };
    expect(r.erro).toContain('troco');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('troco como texto "R$ 100,00" funciona', async () => {
    await executePizzeriaTool('registrar_pedido', { ...bigOrder, troco_para: 'R$ 100,00' }, ctx());
    expect(createOrder.mock.calls[0][0].changeFor).toBe(100);
  });

  it('sem forma de pagamento: pergunta', async () => {
    const r = (await executePizzeriaTool('registrar_pedido', { ...bigOrder, pagamento: '' }, ctx())) as { erro: string };
    expect(r.erro).toContain('pagamento');
  });

  it('sem nome: usa o nome do WhatsApp', async () => {
    await executePizzeriaTool('registrar_pedido', { ...bigOrder, nome_cliente: '' }, ctx());
    expect(createOrder.mock.calls[0][0].customerName).toBe('Maria Souza');
  });

  it('sabor que pode ser dois itens: não registra, devolve as opções', async () => {
    const twoCheddars = [...menu, pizza('Frango com Cheddar', 35, 64)];
    const r = (await executePizzeriaTool(
      'registrar_pedido',
      { ...bigOrder, itens: [{ item: 'cheddar', tamanho: 'grande' }] },
      ctx({ menu: twoCheddars })
    )) as { erro: string };
    expect(r.erro).toContain('Calabresa com Cheddar');
    expect(createOrder).not.toHaveBeenCalled();
  });
});

describe('pedido duplicado', () => {
  const sameOrderSaved = async () => {
    // Registra uma vez para pegar os itens exatamente como ficam gravados.
    await executePizzeriaTool('registrar_pedido', bigOrder, ctx());
    const input = createOrder.mock.calls[0][0];
    vi.clearAllMocks();
    return { order_number: 42, total: input.priced.total, items: input.priced.lines, fulfillment: 'ENTREGA', status: 'NOVO' };
  };

  it('mesmo pedido registrado de novo em poucos minutos: devolve o mesmo número, sem duplicar', async () => {
    const saved = await sameOrderSaved();
    loadCustomerOrders.mockResolvedValue([{ ...saved, created_at: new Date(friday20h.getTime() - 60_000).toISOString() }]);
    const r = (await executePizzeriaTool('registrar_pedido', bigOrder, ctx())) as { ok: boolean; pedido: { numero: number }; observacao: string };
    expect(r.ok).toBe(true);
    expect(r.pedido.numero).toBe(42);
    expect(r.observacao).toContain('já estava registrado');
    expect(createOrder).not.toHaveBeenCalled();
    expect(notifyTenantAdmins).not.toHaveBeenCalled();
  });

  it('mesmo pedido de mais de 10 minutos atrás é um pedido novo (cliente pediu de novo)', async () => {
    const saved = await sameOrderSaved();
    loadCustomerOrders.mockResolvedValue([{ ...saved, created_at: new Date(friday20h.getTime() - 15 * 60_000).toISOString() }]);
    await executePizzeriaTool('registrar_pedido', bigOrder, ctx());
    expect(createOrder).toHaveBeenCalledOnce();
  });

  it('pedido diferente logo em seguida é registrado normalmente', async () => {
    const saved = await sameOrderSaved();
    loadCustomerOrders.mockResolvedValue([{ ...saved, created_at: new Date(friday20h.getTime() - 60_000).toISOString() }]);
    await executePizzeriaTool('registrar_pedido', { ...bigOrder, itens: [{ item: 'portuguesa', tamanho: 'broto' }] }, ctx());
    expect(createOrder).toHaveBeenCalledOnce();
  });
});

describe('status e equipe', () => {
  it('cliente sem pedido', async () => {
    const r = (await executePizzeriaTool('status_pedido', {}, ctx())) as { observacao: string };
    expect(r.observacao).toContain('Nenhum pedido');
  });

  it('reclamação vai para a equipe', async () => {
    handOffToTeam.mockResolvedValue({ ok: true });
    const r = (await executePizzeriaTool('chamar_equipe', { motivo: 'pedido atrasado' }, ctx())) as { observacao: string };
    expect(handOffToTeam).toHaveBeenCalledWith(expect.objectContaining({ leadId: 'l1' }), 'pedido atrasado', '/pedidos');
    expect(r.observacao).toContain('Equipe avisada');
  });
});

describe('casos de borda do cálculo', () => {
  const calc = (items: Record<string, unknown>[], s: Partial<PizzeriaSettings> = {}, fulfillment: 'ENTREGA' | 'RETIRADA' = 'RETIRADA', area?: string) =>
    priceOrder({ menu, settings: { ...settings, ...s }, items, fulfillment, area });

  it('quantidade inválida (0, quebrada ou absurda)', () => {
    for (const q of [0, 2.5, 51, -1]) expect(calc([{ item: 'coca lata', quantidade: q }]).ok).toBe(false);
  });

  it('mais de 30 itens num pedido', () => {
    expect(calc(Array.from({ length: 31 }, () => ({ item: 'coca lata' }))).ok).toBe(false);
  });

  it('três sabores quando a loja aceita só dois', () => {
    expect(calc([{ sabores: ['calabresa', 'portuguesa', '4 queijos'], tamanho: 'grande' }]).ok).toBe(false);
    expect(calc([{ sabores: ['calabresa', 'portuguesa', '4 queijos'], tamanho: 'grande' }], { max_flavors: 3 }).ok).toBe(true);
  });

  it('meio a meio pela média quando a loja configurar assim', () => {
    const r = calc([{ sabores: ['calabresa', '4 queijos'], tamanho: 'grande' }], { half_half_rule: 'MEDIA' });
    expect(r.ok && r.order.lines[0].unit_price).toBe(61.5);
  });

  it('pedido mínimo não conta a taxa de entrega', () => {
    const r = calc([{ item: 'coca lata' }], { min_order: 30 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('mínimo');
  });

  it('loja só com retirada não aceita entrega, e vice-versa', () => {
    expect(calc([{ item: 'coca lata' }], { delivery_enabled: false }, 'ENTREGA', 'centro').ok).toBe(false);
    expect(calc([{ item: 'coca lata' }], { pickup_enabled: false }, 'RETIRADA').ok).toBe(false);
  });

  it('taxa única quando não há lista de bairros', () => {
    const r = calc([{ item: 'coca lata', quantidade: 5 }], { delivery_areas: [], delivery_fee: 8 }, 'ENTREGA', 'qualquer bairro');
    expect(r.ok && r.order.delivery_fee).toBe(8);
  });

  it('tamanho abreviado que serve para dois tamanhos: pergunta', () => {
    const withGigante = [
      item('Mussarela', 'Pizzas', [
        { size: 'Grande', price: 50 },
        { size: 'Gigante', price: 70 },
      ]),
    ];
    const r = priceOrder({ menu: withGigante, settings, items: [{ item: 'mussarela', tamanho: 'G' }], fulfillment: 'RETIRADA' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('tamanho');
  });

  it('item que saiu do cardápio não pode ser pedido', () => {
    expect(calc([{ item: 'atum', tamanho: 'grande' }]).ok).toBe(false);
  });
});

describe('horário de funcionamento', () => {
  const hours = DEFAULT_PIZZERIA_SETTINGS.weekly_hours.map((d) => ({ ...d }));
  hours[5] = { enabled: true, open: '18:00', close: '02:00' }; // sexta vira a noite

  it('sexta das 18h às 2h da manhã de sábado', () => {
    expect(isOpenAt(new Date('2026-11-27T20:59:00Z'), hours)).toBe(false); // sexta 17h59
    expect(isOpenAt(new Date('2026-11-27T21:00:00Z'), hours)).toBe(true); // sexta 18h
    expect(isOpenAt(new Date('2026-11-28T04:00:00Z'), hours)).toBe(true); // sábado 1h
    expect(isOpenAt(new Date('2026-11-28T05:30:00Z'), hours)).toBe(false); // sábado 2h30
  });

  it('segunda fechada (padrão)', () => {
    expect(isOpenAt(monday20h, DEFAULT_PIZZERIA_SETTINGS.weekly_hours)).toBe(false);
  });
});

describe('etapas do pedido no quadro', () => {
  it('próximo passo segue o tipo do pedido', () => {
    expect(nextStatus('NOVO', 'ENTREGA')).toBe('EM_PREPARO');
    expect(nextStatus('EM_PREPARO', 'ENTREGA')).toBe('SAIU_ENTREGA');
    expect(nextStatus('EM_PREPARO', 'RETIRADA')).toBe('PRONTO_RETIRADA');
    expect(nextStatus('ENTREGUE', 'ENTREGA')).toBeNull();
  });

  it('não volta etapa, não mexe em pedido finalizado, pode cancelar a qualquer momento antes', () => {
    expect(canMoveTo('SAIU_ENTREGA', 'EM_PREPARO', 'ENTREGA')).toBe(false);
    expect(canMoveTo('ENTREGUE', 'CANCELADO', 'ENTREGA')).toBe(false);
    expect(canMoveTo('EM_PREPARO', 'CANCELADO', 'ENTREGA')).toBe(true);
    expect(canMoveTo('NOVO', 'ENTREGUE', 'RETIRADA')).toBe(true); // balcão entrega na hora
    expect(canMoveTo('EM_PREPARO', 'SAIU_ENTREGA', 'RETIRADA')).toBe(false); // retirada não sai para entrega
  });

  it('mensagens para o cliente em cada etapa', () => {
    const base = { orderNumber: 42, customerName: 'Maria Souza', etaMinutes: 40, companyName: 'Pizzaria Teste' };
    expect(statusMessage({ ...base, status: 'NOVO', fulfillment: 'ENTREGA' })).toBeNull();
    expect(statusMessage({ ...base, status: 'EM_PREPARO', fulfillment: 'ENTREGA' })).toContain('40 minutos');
    expect(statusMessage({ ...base, status: 'PRONTO_RETIRADA', fulfillment: 'RETIRADA' })).toContain('Pizzaria Teste');
    expect(statusMessage({ ...base, status: 'CANCELADO', fulfillment: 'ENTREGA', cancelReason: 'acabou a massa' })).toContain('acabou a massa');
    expect(statusMessage({ ...base, status: 'SAIU_ENTREGA', fulfillment: 'ENTREGA' })).toMatch(/^Maria, /);
  });

  it('aviso de etapa só dentro das 24h da última mensagem do cliente (regra da Meta)', () => {
    const now = new Date('2026-11-27T23:00:00Z');
    expect(insideServiceWindow(new Date(now.getTime() - 23 * 3600_000), now)).toBe(true);
    expect(insideServiceWindow(new Date(now.getTime() - 24 * 3600_000), now)).toBe(false);
    expect(insideServiceWindow(null, now)).toBe(false);
  });
});
