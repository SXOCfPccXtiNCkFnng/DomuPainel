/**
 * "Sexta à noite": cardápio de pizzaria de verdade e pedidos escritos como o
 * cliente escreve. O valor sai sempre do cardápio; nome parecido nunca pode
 * virar outro item em silêncio (pizza errada = prejuízo na hora).
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PIZZERIA_SETTINGS,
  deliveryFeeFor,
  findMenuItem,
  matchMenuItem,
  menuItemFromRow,
  priceOrder,
  type MenuItem,
  type PizzeriaSettings,
} from '../pizzeria';

const sizes = (broto: number, media: number, grande: number) => [
  { size: 'Broto', price: broto },
  { size: 'Média', price: media },
  { size: 'Grande', price: grande },
];
let id = 0;
const item = (name: string, category: string, prices: { size: string; price: number }[], allows_half = true): MenuItem =>
  menuItemFromRow({ id: String(++id), name, category, prices, allows_half, active: true });

const menu: MenuItem[] = [
  item('Calabresa', 'Pizzas', sizes(30, 45, 55)),
  item('Calabresa com Cheddar', 'Pizzas', sizes(34, 50, 62)),
  item('Frango', 'Pizzas', sizes(30, 45, 55)),
  item('Frango com Catupiry', 'Pizzas', sizes(35, 52, 65)),
  item('Frango com Cheddar', 'Pizzas', sizes(35, 52, 64)),
  item('Quatro Queijos', 'Pizzas', sizes(36, 54, 68)),
  item('Portuguesa', 'Pizzas', sizes(33, 50, 60)),
  item('Marguerita', 'Pizzas', sizes(30, 45, 56)),
  item('Chocolate com Morango', 'Pizzas doces', sizes(32, 48, 60)),
  item('Coca-Cola Lata', 'Bebidas', [{ size: '', price: 6 }], false),
  item('Coca-Cola 2L', 'Bebidas', [{ size: '', price: 14 }], false),
  item('Guaraná 2L', 'Bebidas', [{ size: '', price: 12 }], false),
];

const settings: PizzeriaSettings = {
  ...DEFAULT_PIZZERIA_SETTINGS,
  delivery_fee: 0,
  delivery_areas: [
    { area: 'Centro', fee: 5 },
    { area: 'Vila Nova', fee: 7 },
    { area: 'Vila Santa Rosa', fee: 9 },
    { area: 'Jardim Bandeirantes', fee: 10 },
  ],
};

const order = (items: Record<string, unknown>[], extra: { fulfillment?: 'ENTREGA' | 'RETIRADA'; area?: string } = {}) =>
  priceOrder({ menu, settings, items, fulfillment: extra.fulfillment ?? 'RETIRADA', area: extra.area });

describe('sabor escrito do jeito do cliente', () => {
  it('"frango catupiry" é Frango com Catupiry, nunca o Frango simples', () => {
    expect(findMenuItem(menu, 'frango catupiry')?.name).toBe('Frango com Catupiry');
    expect(findMenuItem(menu, 'pizza de frango c/ catupiry')?.name).toBe('Frango com Catupiry');
  });

  it('nome exato continua valendo, mesmo quando existe um maior', () => {
    expect(findMenuItem(menu, 'Frango')?.name).toBe('Frango');
    expect(findMenuItem(menu, 'calabresa')?.name).toBe('Calabresa');
  });

  it('"4 queijos" acha Quatro Queijos', () => {
    expect(findMenuItem(menu, '4 queijos')?.name).toBe('Quatro Queijos');
  });

  it('pedaço que serve para mais de um item não escolhe sozinho: pede para confirmar', () => {
    const m = matchMenuItem(menu, 'cheddar'); // Calabresa com Cheddar ou Frango com Cheddar?
    expect(m.item).toBeNull();
    expect(m.options.map((o) => o.name)).toEqual(['Calabresa com Cheddar', 'Frango com Cheddar']);
    const coca = matchMenuItem(menu, 'coca'); // lata ou 2L?
    expect(coca.item).toBeNull();
    expect(coca.options.map((o) => o.name)).toEqual(['Coca-Cola Lata', 'Coca-Cola 2L']);
  });

  it('variação que não existe no cardápio não vira outro sabor em silêncio', () => {
    const r = order([{ item: 'calabresa acebolada', tamanho: 'grande' }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Calabresa');
  });

  it('bebida com nome curto', () => {
    expect(findMenuItem(menu, 'coca lata')?.name).toBe('Coca-Cola Lata');
    expect(findMenuItem(menu, 'coca 2l')?.name).toBe('Coca-Cola 2L');
    expect(findMenuItem(menu, 'guarana 2 litros')).toBeNull(); // "litros" não está no nome: confirma com o cliente
  });
});

describe('pedido completo de sexta à noite', () => {
  it('grande meio calabresa meio 4 queijos, sem cebola, mais 2 cocas lata, entrega no Centro', () => {
    const r = order(
      [
        { sabores: ['calabresa', '4 queijos'], tamanho: 'G', observacao: 'sem cebola' },
        { item: 'coca lata', quantidade: 2 },
      ],
      { fulfillment: 'ENTREGA', area: 'centro' }
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Meio a meio cobra o sabor mais caro (padrão): Quatro Queijos grande = 68.
    expect(r.order.lines[0].unit_price).toBe(68);
    expect(r.order.lines[0].notes).toBe('sem cebola');
    expect(r.order.lines[1].total).toBe(12);
    expect(r.order.delivery_fee).toBe(5);
    expect(r.order.total).toBe(85);
  });

  it('tamanho faltando: pede o tamanho em vez de chutar', () => {
    const r = order([{ item: 'portuguesa' }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('tamanho');
  });

  it('pizza doce não pode ir meio a meio com salgada se a loja não permitir', () => {
    const noHalf = menu.map((m) => (m.name === 'Chocolate com Morango' ? { ...m, allows_half: false } : m));
    const r = priceOrder({ menu: noHalf, settings, items: [{ sabores: ['calabresa', 'chocolate com morango'], tamanho: 'grande' }], fulfillment: 'RETIRADA' });
    expect(r.ok).toBe(false);
  });
});

describe('taxa de entrega por bairro', () => {
  it('bairro escrito pela metade e que serve para dois bairros não escolhe sozinho', () => {
    expect(deliveryFeeFor(settings, 'vila')).toBeNull();
    expect(deliveryFeeFor(settings, 'Vila Nova')?.fee).toBe(7);
    expect(deliveryFeeFor(settings, 'santa rosa')?.fee).toBe(9);
    expect(deliveryFeeFor(settings, 'jd bandeirantes')?.fee).toBe(10);
  });
});

describe('pedido registrado duas vezes', () => {
  it('mesmos itens em outra ordem contam como o mesmo pedido; observação diferente não', async () => {
    const { orderSignature } = await import('../pizzeriaTools');
    const a = [
      { quantity: 1, description: 'Pizza Grande meio Calabresa / meio Quatro Queijos', notes: 'sem cebola' },
      { quantity: 2, description: 'Coca-Cola Lata', notes: null },
    ];
    const b = [a[1], a[0]];
    expect(orderSignature(a)).toBe(orderSignature(b));
    expect(orderSignature(a)).not.toBe(orderSignature([{ ...a[0], notes: null }, a[1]]));
  });
});
