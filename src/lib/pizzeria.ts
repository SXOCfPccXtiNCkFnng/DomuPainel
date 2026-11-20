/**
 * Módulo Pizzaria e Delivery (segmento 'alimentacao'). Regras puras, sem
 * banco: usadas pela tela, pela API e pela atendente de IA. O valor de um
 * pedido é SEMPRE calculado aqui, a partir do cardápio — nunca pela IA.
 */
import {
  addDaysToKey,
  brtDateKey,
  brtMinutesOfDay,
  brtWeekday,
  parseTime,
  WEEKDAY_LABELS,
  type DayHours,
} from '@/lib/scheduling';

export function isPizzeriaSegment(segment: string | null | undefined): boolean {
  return segment === 'alimentacao';
}

/* ------------------------------------------------------------------ */
/* Texto e dinheiro                                                    */
/* ------------------------------------------------------------------ */

export function cleanText(value: unknown, max: number, opts?: { singleLine?: boolean }): string {
  let text = String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<{2,}|>{2,}/g, '');
  text = opts?.singleLine === false ? text.replace(/[ \t]+/g, ' ') : text.replace(/\s+/g, ' ');
  return text.trim().slice(0, max);
}

export function normalizeName(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MONEY_MAX = 100_000;

/** "59,90" / "59.90" / 59.9 → 59.9; vazio → null; inválido → 'invalid'. */
export function parseMoney(value: unknown): number | null | 'invalid' {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 && value <= MONEY_MAX ? Math.round(value * 100) / 100 : 'invalid';
  }
  const raw = String(value).replace(/[R$\s]/g, '');
  const n = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
  if (!Number.isFinite(n) || n < 0 || n > MONEY_MAX) return 'invalid';
  return Math.round(n * 100) / 100;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function formatBRL(value: number | null | undefined): string {
  if (value == null) return '';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* ------------------------------------------------------------------ */
/* Cardápio                                                            */
/* ------------------------------------------------------------------ */

/** Serve para qualquer delivery de comida: pizzaria, hamburgueria, dogão, açaí, marmita... */
export const MENU_CATEGORIES = [
  'Pizzas',
  'Pizzas doces',
  'Hambúrgueres',
  'Lanches',
  'Cachorro-quente',
  'Pastéis',
  'Esfihas',
  'Pratos e marmitas',
  'Japonesa',
  'Porções',
  'Açaí e sorvetes',
  'Saladas',
  'Adicionais',
  'Combos',
  'Bebidas',
  'Sobremesas',
  'Outros',
] as const;

/** Sugestões de tamanho (o dono pode escrever outro). */
export const SIZE_SUGGESTIONS = ['Broto', 'Média', 'Grande', 'Gigante'];

export const MENU_NAME_MAX = 120;
export const MENU_DESCRIPTION_MAX = 300;
export const SIZE_MAX = 30;
export const PRICES_MAX = 6;
export const MENU_ITEMS_MAX = 400;

export type MenuPrice = { size: string; price: number };

export type MenuItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  prices: MenuPrice[];
  allows_half: boolean;
  featured: boolean;
  active: boolean;
  sort_order: number;
};

export type MenuItemFields = Omit<MenuItem, 'id'>;

export function validateMenuItemInput(
  input: Record<string, unknown>
): { ok: true; fields: MenuItemFields } | { ok: false; error: string } {
  const name = cleanText(input.name, MENU_NAME_MAX);
  if (name.length < 2) return { ok: false, error: 'Dê um nome ao item (ex.: Calabresa).' };
  const category = cleanText(input.category, 40);
  if (!(MENU_CATEGORIES as readonly string[]).includes(category)) return { ok: false, error: 'Escolha a categoria.' };

  const rawPrices = Array.isArray(input.prices) ? input.prices : [];
  const prices: MenuPrice[] = [];
  const seen = new Set<string>();
  for (const raw of rawPrices.slice(0, PRICES_MAX + 2)) {
    const row = (raw || {}) as Record<string, unknown>;
    const size = cleanText(row.size, SIZE_MAX);
    const price = parseMoney(row.price);
    if (price === null && !size) continue; // linha vazia
    if (price === 'invalid' || price === null || price <= 0) {
      return { ok: false, error: `Informe um preço válido${size ? ` para o tamanho ${size}` : ''}.` };
    }
    const key = normalizeName(size);
    if (seen.has(key)) return { ok: false, error: `Tamanho repetido: ${size || 'preço único'}.` };
    seen.add(key);
    prices.push({ size, price });
  }
  if (!prices.length) return { ok: false, error: 'Informe o preço (ou os preços por tamanho).' };
  if (prices.length > PRICES_MAX) return { ok: false, error: `No máximo ${PRICES_MAX} tamanhos por item.` };
  if (prices.length > 1 && prices.some((p) => !p.size)) {
    return { ok: false, error: 'Com mais de um preço, dê o nome de cada tamanho.' };
  }

  const sort = Number(input.sort_order ?? 0);
  return {
    ok: true,
    fields: {
      category,
      name,
      description: cleanText(input.description, MENU_DESCRIPTION_MAX) || null,
      prices,
      allows_half: Boolean(input.allows_half) && prices.some((p) => p.size),
      featured: Boolean(input.featured),
      active: input.active === undefined ? true : Boolean(input.active),
      sort_order: Number.isInteger(sort) && sort >= 0 && sort <= 9999 ? sort : 0,
    },
  };
}

export function menuItemFromRow(row: Record<string, unknown>): MenuItem {
  const prices = (Array.isArray(row.prices) ? row.prices : [])
    .map((p) => {
      const r = (p || {}) as Record<string, unknown>;
      return { size: String(r.size ?? ''), price: Number(r.price) };
    })
    .filter((p) => Number.isFinite(p.price) && p.price > 0);
  return {
    id: String(row.id),
    category: String(row.category ?? 'Outros'),
    name: String(row.name ?? ''),
    description: (row.description as string) || null,
    prices,
    allows_half: Boolean(row.allows_half),
    featured: Boolean(row.featured),
    active: row.active !== false,
    sort_order: Number(row.sort_order ?? 0),
  };
}

/** "Broto R$ 35 · Grande R$ 59,90" ou "R$ 8". */
export function pricesLabel(prices: MenuPrice[]): string {
  return prices.map((p) => (p.size ? `${p.size} ${formatBRL(p.price)}` : formatBRL(p.price))).join(' · ');
}

/** Ordem da tela e do prompt: categoria, ordem manual, nome. */
export function sortMenu(items: MenuItem[]): MenuItem[] {
  const rank = (c: string) => {
    const i = (MENU_CATEGORIES as readonly string[]).indexOf(c);
    return i === -1 ? MENU_CATEGORIES.length : i;
  };
  return [...items].sort(
    (a, b) => rank(a.category) - rank(b.category) || a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'pt-BR')
  );
}

/** Acha o item pelo nome que o cliente (ou a IA) escreveu. */
export function findMenuItem(menu: MenuItem[], name: unknown): MenuItem | null {
  const wanted = normalizeName(name).replace(/^(pizza|esfiha|esfirra) (de )?/, '');
  if (!wanted) return null;
  const active = menu.filter((m) => m.active);
  const norm = (m: MenuItem) => normalizeName(m.name).replace(/^(pizza|esfiha|esfirra) (de )?/, '');
  return (
    active.find((m) => norm(m) === wanted) ||
    active.find((m) => norm(m).startsWith(wanted) || wanted.startsWith(norm(m))) ||
    (wanted.length >= 4 ? active.find((m) => norm(m).includes(wanted)) : undefined) ||
    null
  );
}

function findPrice(item: MenuItem, size: unknown): MenuPrice | null {
  if (item.prices.length === 1 && !item.prices[0].size) return item.prices[0];
  const wanted = normalizeName(size);
  if (!wanted) return null;
  return (
    item.prices.find((p) => normalizeName(p.size) === wanted) ||
    item.prices.find((p) => normalizeName(p.size).startsWith(wanted) || wanted.startsWith(normalizeName(p.size))) ||
    null
  );
}

/* ------------------------------------------------------------------ */
/* Configuração: entrega, retirada e horário                           */
/* ------------------------------------------------------------------ */

export type HalfHalfRule = 'MAIOR' | 'MEDIA';
export type DeliveryArea = { area: string; fee: number };

export type PizzeriaSettings = {
  weekly_hours: DayHours[];
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_fee: number;
  delivery_areas: DeliveryArea[];
  min_order: number;
  delivery_eta_min: number;
  pickup_eta_min: number;
  half_half_rule: HalfHalfRule;
  max_flavors: number;
  notify_status: boolean;
};

export const DELIVERY_AREAS_MAX = 80;

/** Terça a domingo, das 18h às 23h30 (segunda fechado) — padrão comum no delivery noturno; o dono ajusta. */
export const DEFAULT_PIZZERIA_HOURS: DayHours[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  enabled: d !== 1,
  open: '18:00',
  close: '23:30',
}));

export const DEFAULT_PIZZERIA_SETTINGS: PizzeriaSettings = {
  weekly_hours: DEFAULT_PIZZERIA_HOURS,
  delivery_enabled: true,
  pickup_enabled: true,
  delivery_fee: 0,
  delivery_areas: [],
  min_order: 0,
  delivery_eta_min: 50,
  pickup_eta_min: 30,
  half_half_rule: 'MAIOR',
  max_flavors: 2,
  notify_status: true,
};

export const HALF_HALF_LABELS: Record<HalfHalfRule, string> = {
  MAIOR: 'Cobra o sabor mais caro',
  MEDIA: 'Cobra a média dos sabores',
};

function validHours(raw: unknown): DayHours[] | null {
  if (!Array.isArray(raw) || raw.length !== 7) return null;
  const out: DayHours[] = [];
  for (const d of raw) {
    const day = (d || {}) as Record<string, unknown>;
    const open = String(day.open ?? '');
    const close = String(day.close ?? '');
    if (parseTime(open) == null || parseTime(close) == null || open === close) return null;
    out.push({ enabled: Boolean(day.enabled), open, close });
  }
  return out;
}

export function validatePizzeriaSettings(
  input: Record<string, unknown>
): { ok: true; settings: PizzeriaSettings } | { ok: false; error: string } {
  const weekly_hours = validHours(input.weekly_hours);
  if (!weekly_hours) return { ok: false, error: 'Confira o horário de funcionamento (abertura e fechamento de cada dia).' };
  const delivery_enabled = Boolean(input.delivery_enabled);
  const pickup_enabled = Boolean(input.pickup_enabled);
  if (!delivery_enabled && !pickup_enabled) return { ok: false, error: 'Ative entrega, retirada ou os dois.' };

  const fee = parseMoney(input.delivery_fee);
  if (fee === 'invalid') return { ok: false, error: 'Taxa de entrega inválida.' };
  const minOrder = parseMoney(input.min_order);
  if (minOrder === 'invalid') return { ok: false, error: 'Pedido mínimo inválido.' };

  const areas: DeliveryArea[] = [];
  const seen = new Set<string>();
  for (const raw of (Array.isArray(input.delivery_areas) ? input.delivery_areas : []).slice(0, DELIVERY_AREAS_MAX + 5)) {
    const row = (raw || {}) as Record<string, unknown>;
    const area = cleanText(row.area, 100);
    if (!area) continue;
    const areaFee = parseMoney(row.fee);
    if (areaFee === 'invalid') return { ok: false, error: `Taxa inválida no bairro ${area}.` };
    const key = normalizeName(area);
    if (seen.has(key)) continue;
    seen.add(key);
    areas.push({ area, fee: areaFee ?? 0 });
  }
  if (areas.length > DELIVERY_AREAS_MAX) return { ok: false, error: `No máximo ${DELIVERY_AREAS_MAX} bairros.` };

  const eta = (v: unknown, fallback: number) => {
    const n = Number(v ?? fallback);
    return Number.isInteger(n) && n >= 5 && n <= 240 ? n : null;
  };
  const deliveryEta = eta(input.delivery_eta_min, 50);
  const pickupEta = eta(input.pickup_eta_min, 30);
  if (deliveryEta == null || pickupEta == null) return { ok: false, error: 'O tempo estimado precisa ser entre 5 e 240 minutos.' };

  const rule = input.half_half_rule === 'MEDIA' ? 'MEDIA' : 'MAIOR';
  const maxFlavors = Number(input.max_flavors ?? 2);
  if (!Number.isInteger(maxFlavors) || maxFlavors < 1 || maxFlavors > 4) {
    return { ok: false, error: 'Sabores por pizza: de 1 a 4.' };
  }

  return {
    ok: true,
    settings: {
      weekly_hours,
      delivery_enabled,
      pickup_enabled,
      delivery_fee: fee ?? 0,
      delivery_areas: areas,
      min_order: minOrder ?? 0,
      delivery_eta_min: deliveryEta,
      pickup_eta_min: pickupEta,
      half_half_rule: rule,
      max_flavors: maxFlavors,
      notify_status: input.notify_status === undefined ? true : Boolean(input.notify_status),
    },
  };
}

export function pizzeriaSettingsFromRow(row: Record<string, unknown> | null | undefined): PizzeriaSettings {
  if (!row) return { ...DEFAULT_PIZZERIA_SETTINGS };
  const parsed = validatePizzeriaSettings({ ...DEFAULT_PIZZERIA_SETTINGS, ...row });
  return parsed.ok ? parsed.settings : { ...DEFAULT_PIZZERIA_SETTINGS };
}

/**
 * Aberto agora? Fechamento menor que a abertura = passa da meia-noite
 * (ex.: 18:00 às 00:30 de sábado vale até 00:30 de domingo).
 */
export function isOpenAt(at: Date, hours: DayHours[]): boolean {
  const today = brtDateKey(at);
  const minutes = brtMinutesOfDay(at);
  const window = (dateKey: string) => {
    const d = hours[brtWeekday(dateKey)];
    if (!d?.enabled) return null;
    const open = parseTime(d.open);
    const close = parseTime(d.close);
    if (open == null || close == null) return null;
    return { open, close, overnight: close <= open };
  };
  const t = window(today);
  if (t && minutes >= t.open && (t.overnight || minutes < t.close)) return true;
  const y = window(addDaysToKey(today, -1));
  return Boolean(y && y.overnight && minutes < y.close);
}

export function formatPizzeriaHours(hours: DayHours[]): string {
  return [1, 2, 3, 4, 5, 6, 0]
    .map((i) => {
      const d = hours[i];
      return `${WEEKDAY_LABELS[i]}: ${d?.enabled ? `${d.open} às ${d.close}` : 'fechado'}`;
    })
    .join('\n');
}

/** Taxa para o bairro: lista vazia = taxa única; bairro fora da lista = null (não entrega). */
export function deliveryFeeFor(settings: PizzeriaSettings, area: unknown): { fee: number; area: string | null } | null {
  if (!settings.delivery_areas.length) return { fee: settings.delivery_fee, area: cleanText(area, 100) || null };
  const wanted = normalizeName(area);
  if (!wanted) return null;
  const match =
    settings.delivery_areas.find((a) => normalizeName(a.area) === wanted) ||
    settings.delivery_areas.find((a) => {
      const n = normalizeName(a.area);
      return n.length >= 4 && (wanted.includes(n) || n.includes(wanted));
    });
  return match ? { fee: match.fee, area: match.area } : null;
}

/* ------------------------------------------------------------------ */
/* Pedido: cálculo                                                     */
/* ------------------------------------------------------------------ */

export type Fulfillment = 'ENTREGA' | 'RETIRADA';

/** Item como chega da IA ou da tela. */
export type OrderItemInput = {
  /** Nome do item (bebida, esfiha) ou sabor único da pizza. */
  item?: unknown;
  /** Sabores da pizza meio a meio (2 ou mais). */
  sabores?: unknown;
  tamanho?: unknown;
  quantidade?: unknown;
  observacao?: unknown;
};

export type OrderLine = {
  description: string;
  size: string | null;
  /** Nomes dos itens do cardápio (1 ou mais, quando meio a meio). */
  flavors: string[];
  category: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes: string | null;
};

export const ORDER_ITEMS_MAX = 30;
export const ORDER_QTY_MAX = 50;

export type PricedOrder = {
  lines: OrderLine[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  area: string | null;
};

export function priceOrder(params: {
  menu: MenuItem[];
  settings: PizzeriaSettings;
  items: OrderItemInput[];
  fulfillment: Fulfillment;
  area?: unknown;
}): { ok: true; order: PricedOrder } | { ok: false; error: string } {
  const { menu, settings } = params;
  const items = Array.isArray(params.items) ? params.items : [];
  if (!items.length) return { ok: false, error: 'O pedido está sem itens.' };
  if (items.length > ORDER_ITEMS_MAX) return { ok: false, error: `No máximo ${ORDER_ITEMS_MAX} itens por pedido.` };

  const lines: OrderLine[] = [];
  for (const raw of items) {
    const input = (raw || {}) as OrderItemInput;
    const qty = Number(input.quantidade ?? 1);
    if (!Number.isInteger(qty) || qty < 1 || qty > ORDER_QTY_MAX) return { ok: false, error: 'Quantidade inválida.' };
    const flavorNames = (Array.isArray(input.sabores) ? input.sabores : [])
      .map((s) => cleanText(s, MENU_NAME_MAX))
      .filter(Boolean);
    const names = flavorNames.length ? flavorNames : [cleanText(input.item, MENU_NAME_MAX)].filter(Boolean);
    if (!names.length) return { ok: false, error: 'Item sem nome.' };
    if (names.length > settings.max_flavors && names.length > 1) {
      return { ok: false, error: `No máximo ${settings.max_flavors} sabores por pizza.` };
    }

    const found: MenuItem[] = [];
    for (const n of names) {
      const item = findMenuItem(menu, n);
      if (!item) return { ok: false, error: `"${n}" não está no cardápio. Use ver_cardapio e o nome exato.` };
      found.push(item);
    }
    const sizeRaw = cleanText(input.tamanho, SIZE_MAX);
    const prices: { item: MenuItem; price: MenuPrice }[] = [];
    for (const item of found) {
      const price = findPrice(item, sizeRaw);
      if (!price) {
        const sizes = item.prices.map((p) => p.size).filter(Boolean).join(', ');
        return { ok: false, error: `Escolha o tamanho de ${item.name}: ${sizes}.` };
      }
      prices.push({ item, price });
    }
    if (found.length > 1) {
      const bad = found.find((i) => !i.allows_half);
      if (bad) return { ok: false, error: `${bad.name} não pode ser meio a meio.` };
      const sizes = new Set(prices.map((p) => normalizeName(p.price.size)));
      if (sizes.size > 1) return { ok: false, error: 'Os sabores de uma pizza precisam ser do mesmo tamanho.' };
    }
    const values = prices.map((p) => p.price.price);
    const unit =
      found.length > 1 && settings.half_half_rule === 'MEDIA'
        ? round2(values.reduce((s, v) => s + v, 0) / values.length)
        : Math.max(...values);
    const size = prices[0].price.size || null;
    const isPizza = found[0].category.startsWith('Pizza') || found.length > 1;
    const base = isPizza && !/^pizza\b/.test(normalizeName(found[0].name)) ? 'Pizza ' : '';
    const description =
      found.length > 1
        ? `${base}${size ? `${size} ` : ''}${found.length === 2 ? 'meio ' : ''}${found.map((f) => f.name).join(found.length === 2 ? ' / meio ' : ' / ')}`
        : `${base}${found[0].name}${size ? ` (${size})` : ''}`;
    lines.push({
      description: description.slice(0, 200),
      size,
      flavors: found.map((f) => f.name),
      category: found[0].category,
      quantity: qty,
      unit_price: unit,
      total: round2(unit * qty),
      notes: cleanText(input.observacao, 150) || null,
    });
  }

  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  let deliveryFee = 0;
  let area: string | null = null;
  if (params.fulfillment === 'ENTREGA') {
    if (!settings.delivery_enabled) return { ok: false, error: 'No momento só fazemos retirada no local.' };
    const fee = deliveryFeeFor(settings, params.area);
    if (!fee) {
      return {
        ok: false,
        error: settings.delivery_areas.length
          ? 'Bairro fora da área de entrega cadastrada. Ofereça retirada ou chame a equipe.'
          : 'Informe o bairro da entrega.',
      };
    }
    deliveryFee = fee.fee;
    area = fee.area;
  } else if (!settings.pickup_enabled) {
    return { ok: false, error: 'No momento só fazemos entrega.' };
  }
  if (settings.min_order > 0 && subtotal < settings.min_order) {
    return { ok: false, error: `O pedido mínimo é ${formatBRL(settings.min_order)} (sem a taxa de entrega).` };
  }
  return { ok: true, order: { lines, subtotal, delivery_fee: deliveryFee, total: round2(subtotal + deliveryFee), area } };
}

/** Resumo em texto (cliente e equipe). */
export function orderSummaryText(order: Pick<PricedOrder, 'lines' | 'subtotal' | 'delivery_fee' | 'total'>): string {
  const lines = order.lines.map(
    (l) => `${l.quantity}x ${l.description} — ${formatBRL(l.total)}${l.notes ? ` (${l.notes})` : ''}`
  );
  if (order.delivery_fee > 0) lines.push(`Taxa de entrega — ${formatBRL(order.delivery_fee)}`);
  lines.push(`Total: ${formatBRL(order.total)}`);
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Pedido: status                                                      */
/* ------------------------------------------------------------------ */

export const ORDER_STATUSES = ['NOVO', 'EM_PREPARO', 'SAIU_ENTREGA', 'PRONTO_RETIRADA', 'ENTREGUE', 'CANCELADO'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NOVO: 'Novo',
  EM_PREPARO: 'Em preparo',
  SAIU_ENTREGA: 'Saiu para entrega',
  PRONTO_RETIRADA: 'Pronto para retirar',
  ENTREGUE: 'Finalizado',
  CANCELADO: 'Cancelado',
};

/** Pedido ainda em andamento (aparece no quadro). */
export const ACTIVE_STATUSES: OrderStatus[] = ['NOVO', 'EM_PREPARO', 'SAIU_ENTREGA', 'PRONTO_RETIRADA'];
/** Pedido que a loja aceitou (conta como venda). */
export const SOLD_STATUSES: OrderStatus[] = ['EM_PREPARO', 'SAIU_ENTREGA', 'PRONTO_RETIRADA', 'ENTREGUE'];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus);
}

/** Próximo passo de cada pedido (o botão principal do quadro). */
export function nextStatus(status: OrderStatus, fulfillment: Fulfillment): OrderStatus | null {
  if (status === 'NOVO') return 'EM_PREPARO';
  if (status === 'EM_PREPARO') return fulfillment === 'ENTREGA' ? 'SAIU_ENTREGA' : 'PRONTO_RETIRADA';
  if (status === 'SAIU_ENTREGA' || status === 'PRONTO_RETIRADA') return 'ENTREGUE';
  return null;
}

export function canMoveTo(from: OrderStatus, to: OrderStatus, fulfillment: Fulfillment): boolean {
  if (from === to) return false;
  if (from === 'ENTREGUE' || from === 'CANCELADO') return false;
  if (to === 'CANCELADO') return true;
  // Avançar pulando etapas é permitido (ex.: balcão já entrega na hora); voltar, não.
  const order: OrderStatus[] =
    fulfillment === 'ENTREGA'
      ? ['NOVO', 'EM_PREPARO', 'SAIU_ENTREGA', 'ENTREGUE']
      : ['NOVO', 'EM_PREPARO', 'PRONTO_RETIRADA', 'ENTREGUE'];
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  return a >= 0 && b > a;
}

export const NEXT_ACTION_LABELS: Record<OrderStatus, string> = {
  NOVO: '',
  EM_PREPARO: 'Aceitar e preparar',
  SAIU_ENTREGA: 'Saiu para entrega',
  PRONTO_RETIRADA: 'Pronto para retirar',
  ENTREGUE: 'Finalizar',
  CANCELADO: 'Cancelar',
};

/** Coluna de horário que cada status grava. */
export function timestampColumnFor(status: OrderStatus): string | null {
  switch (status) {
    case 'EM_PREPARO':
      return 'accepted_at';
    case 'SAIU_ENTREGA':
    case 'PRONTO_RETIRADA':
      return 'dispatched_at';
    case 'ENTREGUE':
      return 'delivered_at';
    case 'CANCELADO':
      return 'cancelled_at';
    default:
      return null;
  }
}

/** Mensagem para o cliente no WhatsApp quando o status muda (null = não avisa). */
export function statusMessage(params: {
  status: OrderStatus;
  orderNumber: number;
  customerName: string;
  fulfillment: Fulfillment;
  etaMinutes: number;
  companyName: string;
  cancelReason?: string | null;
}): string | null {
  const first = cleanText(params.customerName, 60).split(' ')[0] || '';
  const hi = first ? `${first}, ` : '';
  const n = `#${params.orderNumber}`;
  switch (params.status) {
    case 'EM_PREPARO':
      return params.fulfillment === 'ENTREGA'
        ? `${hi}seu pedido ${n} foi confirmado e já está sendo preparado! 😋 Previsão de entrega: cerca de ${params.etaMinutes} minutos.`
        : `${hi}seu pedido ${n} foi confirmado e já está sendo preparado! 😋 Fica pronto para retirar em cerca de ${params.etaMinutes} minutos.`;
    case 'SAIU_ENTREGA':
      return `${hi}seu pedido ${n} saiu para entrega! 🛵 Já já chega aí.`;
    case 'PRONTO_RETIRADA':
      return `${hi}seu pedido ${n} está pronto para retirar aqui na ${cleanText(params.companyName, 80)}. 😋`;
    case 'ENTREGUE':
      return `Obrigado pelo pedido, ${first || 'tudo certo'}! Bom apetite. Se puder, conta pra gente o que achou. 💛`;
    case 'CANCELADO':
      return `${hi}seu pedido ${n} foi cancelado${params.cancelReason ? `: ${cleanText(params.cancelReason, 150)}` : ''}. Qualquer dúvida, é só chamar por aqui.`;
    default:
      return null;
  }
}

/** A Meta só deixa mandar texto livre até 24h depois da última mensagem do cliente. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function insideServiceWindow(lastInboundAt: Date | null, now: Date): boolean {
  return Boolean(lastInboundAt && now.getTime() - lastInboundAt.getTime() < SERVICE_WINDOW_MS - 60_000);
}

export const PAYMENT_METHODS = ['PIX', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Vale-refeição'] as const;

export type Order = {
  id: string;
  order_number: number;
  lead_id: string | null;
  customer_name: string;
  customer_phone: string;
  items: OrderLine[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  fulfillment: Fulfillment;
  address: string | null;
  area: string | null;
  payment_method: string | null;
  change_for: number | null;
  notes: string | null;
  status: OrderStatus;
  source: 'WHATSAPP' | 'PANEL';
  cancel_reason: string | null;
  status_notice: string | null;
  accepted_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

export function orderFromRow(row: Record<string, unknown>): Order {
  const num = (v: unknown) => (v == null ? null : Number(v));
  const str = (v: unknown) => (v == null || v === '' ? null : String(v));
  return {
    id: String(row.id),
    order_number: Number(row.order_number ?? 0),
    lead_id: str(row.lead_id),
    customer_name: String(row.customer_name ?? ''),
    customer_phone: String(row.customer_phone ?? ''),
    items: (Array.isArray(row.items) ? row.items : []) as OrderLine[],
    subtotal: Number(row.subtotal ?? 0),
    delivery_fee: Number(row.delivery_fee ?? 0),
    total: Number(row.total ?? 0),
    fulfillment: row.fulfillment === 'RETIRADA' ? 'RETIRADA' : 'ENTREGA',
    address: str(row.address),
    area: str(row.area),
    payment_method: str(row.payment_method),
    change_for: num(row.change_for),
    notes: str(row.notes),
    status: isOrderStatus(row.status) ? row.status : 'NOVO',
    source: row.source === 'PANEL' ? 'PANEL' : 'WHATSAPP',
    cancel_reason: str(row.cancel_reason),
    status_notice: str(row.status_notice),
    accepted_at: str(row.accepted_at),
    dispatched_at: str(row.dispatched_at),
    delivered_at: str(row.delivered_at),
    cancelled_at: str(row.cancelled_at),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

/* ------------------------------------------------------------------ */
/* Métricas                                                            */
/* ------------------------------------------------------------------ */

export const LAPSED_MIN_DAYS = 21;
export const LAPSED_MAX_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;
export const phoneKey = (phone: string) => String(phone || '').replace(/\D/g, '').slice(-8);

export type OrderMetrics = {
  days: number;
  revenue: number;
  prevRevenue: number;
  orders: number;
  prevOrders: number;
  averageTicket: number;
  prevAverageTicket: number;
  cancelled: number;
  cancelRate: number;
  lostRevenue: number;
  byWhatsApp: number;
  byWhatsAppRevenue: number;
  delivery: number;
  pickup: number;
  deliveryFees: number;
  /** Minutos do aceite até sair para entrega/ficar pronto, e do pedido até finalizar (só entregas). */
  avgPrepMinutes: number | null;
  avgDeliveryMinutes: number | null;
  /** Pedidos que ficaram mais de 10 min esperando a loja aceitar. */
  slowAccept: number;
  daily: { date: string; orders: number; revenue: number }[];
  weekdays: { weekday: number; label: string; orders: number; revenue: number }[];
  hours: { hour: number; orders: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
  categories: { category: string; quantity: number; revenue: number }[];
  customers: { unique: number; new: number; returning: number; repeatRate: number };
  topCustomers: { name: string; phone: string; orders: number; revenue: number }[];
  lapsed: { count: number; sample: string[]; leadIds: string[] };
  bestWeekday: string | null;
  weakestWeekday: string | null;
  peakHour: number | null;
};

/**
 * Números do período (últimos `days` dias até `now`) a partir dos pedidos.
 * `orders` precisa trazer o histórico (de preferência 120 dias ou mais) para
 * separar cliente novo de antigo e achar quem sumiu.
 */
export function computeOrderMetrics(orders: Order[], now: Date, days: number): OrderMetrics {
  const end = now.getTime();
  const start = end - days * DAY_MS;
  const prevStart = start - days * DAY_MS;
  const at = (o: Order) => new Date(o.created_at).getTime();
  const sold = (o: Order) => SOLD_STATUSES.includes(o.status);

  const inRange = orders.filter((o) => at(o) >= start && at(o) <= end);
  const prev = orders.filter((o) => at(o) >= prevStart && at(o) < start);
  const soldNow = inRange.filter(sold);
  const soldPrev = prev.filter(sold);
  const sum = (list: Order[]) => round2(list.reduce((s, o) => s + o.total, 0));

  const revenue = sum(soldNow);
  const prevRevenue = sum(soldPrev);
  const cancelledList = inRange.filter((o) => o.status === 'CANCELADO');

  // Tempos.
  const minutes = (a: string | null, b: string | null) =>
    a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 60000 : null;
  const avg = (vals: (number | null)[]) => {
    const ok = vals.filter((v): v is number => v != null && v >= 0 && v < 600);
    return ok.length ? Math.round(ok.reduce((s, v) => s + v, 0) / ok.length) : null;
  };
  const avgPrep = avg(soldNow.map((o) => minutes(o.accepted_at, o.dispatched_at)));
  const avgDelivery = avg(
    soldNow.filter((o) => o.fulfillment === 'ENTREGA' && o.status === 'ENTREGUE').map((o) => minutes(o.created_at, o.delivered_at))
  );
  const slowAccept = inRange.filter((o) => {
    const m = minutes(o.created_at, o.accepted_at);
    return m != null && m > 10;
  }).length;

  // Série diária, dia da semana, horário.
  const dayMap = new Map<string, { orders: number; revenue: number }>();
  for (let i = days - 1; i >= 0; i--) dayMap.set(brtDateKey(new Date(end - i * DAY_MS)), { orders: 0, revenue: 0 });
  const weekdays = WEEKDAY_LABELS.map((label, weekday) => ({ weekday, label, orders: 0, revenue: 0 }));
  const hourMap = new Map<number, number>();
  for (const o of soldNow) {
    const d = new Date(o.created_at);
    const key = brtDateKey(d);
    const slot = dayMap.get(key);
    if (slot) {
      slot.orders++;
      slot.revenue += o.total;
    }
    const w = weekdays[brtWeekday(key)];
    w.orders++;
    w.revenue += o.total;
    const hour = Math.floor(brtMinutesOfDay(d) / 60);
    hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
  }
  const activeDays = weekdays.filter((d) => d.orders > 0).sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);
  const hasPattern = soldNow.length >= 10 && days >= 14;
  const hours = [...hourMap.entries()].map(([hour, n]) => ({ hour, orders: n })).sort((a, b) => a.hour - b.hour);
  const peak = [...hours].sort((a, b) => b.orders - a.orders)[0];

  // Itens e categorias (meio a meio divide a quantidade entre os sabores).
  const itemMap = new Map<string, { quantity: number; revenue: number }>();
  const catMap = new Map<string, { quantity: number; revenue: number }>();
  for (const o of soldNow) {
    for (const l of o.items || []) {
      const flavors = l.flavors?.length ? l.flavors : [l.description];
      const share = 1 / flavors.length;
      for (const f of flavors) {
        const cur = itemMap.get(f) || { quantity: 0, revenue: 0 };
        cur.quantity += l.quantity * share;
        cur.revenue += Number(l.total || 0) * share;
        itemMap.set(f, cur);
      }
      const c = catMap.get(l.category || 'Outros') || { quantity: 0, revenue: 0 };
      c.quantity += l.quantity;
      c.revenue += Number(l.total || 0);
      catMap.set(l.category || 'Outros', c);
    }
  }

  // Clientes.
  const firstSold = new Map<string, number>();
  const lastSold = new Map<string, { at: number; name: string; leadId: string | null; phone: string }>();
  for (const o of orders) {
    if (!sold(o)) continue;
    const key = phoneKey(o.customer_phone);
    if (!key) continue;
    firstSold.set(key, Math.min(firstSold.get(key) ?? Infinity, at(o)));
    const cur = lastSold.get(key);
    if (!cur || at(o) > cur.at) lastSold.set(key, { at: at(o), name: o.customer_name, leadId: o.lead_id ?? cur?.leadId ?? null, phone: o.customer_phone });
  }
  const periodCustomers = new Map<string, { name: string; phone: string; orders: number; revenue: number }>();
  for (const o of soldNow) {
    const key = phoneKey(o.customer_phone);
    if (!key) continue;
    const cur = periodCustomers.get(key) || { name: o.customer_name, phone: o.customer_phone, orders: 0, revenue: 0 };
    cur.orders++;
    cur.revenue += o.total;
    periodCustomers.set(key, cur);
  }
  let newCustomers = 0;
  for (const key of periodCustomers.keys()) if ((firstSold.get(key) ?? 0) >= start) newCustomers++;
  const repeaters = [...periodCustomers.values()].filter((c) => c.orders >= 2).length;

  const lapsed = [...lastSold.values()]
    .filter((v) => {
      const d = (end - v.at) / DAY_MS;
      return d >= LAPSED_MIN_DAYS && d <= LAPSED_MAX_DAYS;
    })
    .sort((a, b) => b.at - a.at);

  const orderCount = soldNow.length;
  const prevCount = soldPrev.length;
  return {
    days,
    revenue,
    prevRevenue,
    orders: orderCount,
    prevOrders: prevCount,
    averageTicket: orderCount ? round2(revenue / orderCount) : 0,
    prevAverageTicket: prevCount ? round2(prevRevenue / prevCount) : 0,
    cancelled: cancelledList.length,
    cancelRate: inRange.length ? Math.round((cancelledList.length / inRange.length) * 100) : 0,
    lostRevenue: sum(cancelledList),
    byWhatsApp: soldNow.filter((o) => o.source === 'WHATSAPP').length,
    byWhatsAppRevenue: sum(soldNow.filter((o) => o.source === 'WHATSAPP')),
    delivery: soldNow.filter((o) => o.fulfillment === 'ENTREGA').length,
    pickup: soldNow.filter((o) => o.fulfillment === 'RETIRADA').length,
    deliveryFees: round2(soldNow.reduce((s, o) => s + o.delivery_fee, 0)),
    avgPrepMinutes: avgPrep,
    avgDeliveryMinutes: avgDelivery,
    slowAccept,
    daily: [...dayMap.entries()].map(([date, v]) => ({ date, orders: v.orders, revenue: round2(v.revenue) })),
    weekdays: weekdays.map((d) => ({ ...d, revenue: round2(d.revenue) })),
    hours,
    topItems: [...itemMap.entries()]
      .map(([name, v]) => ({ name, quantity: Math.round(v.quantity * 10) / 10, revenue: round2(v.revenue) }))
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 10),
    categories: [...catMap.entries()]
      .map(([category, v]) => ({ category, quantity: v.quantity, revenue: round2(v.revenue) }))
      .sort((a, b) => b.revenue - a.revenue),
    customers: {
      unique: periodCustomers.size,
      new: newCustomers,
      returning: periodCustomers.size - newCustomers,
      repeatRate: periodCustomers.size ? Math.round((repeaters / periodCustomers.size) * 100) : 0,
    },
    topCustomers: [...periodCustomers.values()]
      .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue)
      .slice(0, 5)
      .map((c) => ({ ...c, revenue: round2(c.revenue) })),
    lapsed: {
      count: lapsed.length,
      sample: lapsed.slice(0, 5).map((v) => v.name.split(' ')[0]).filter(Boolean),
      leadIds: lapsed.map((v) => v.leadId).filter((id): id is string => Boolean(id)).slice(0, 500),
    },
    bestWeekday: hasPattern && activeDays[0] ? activeDays[0].label : null,
    weakestWeekday: hasPattern && activeDays.length > 1 ? activeDays[activeDays.length - 1].label : null,
    peakHour: peak ? peak.hour : null,
  };
}

/**
 * Pedidos no formato do Financeiro (o mesmo resumo dos ramos com agenda):
 * vendido = feito; aguardando aceite = previsto; cancelado = perdido.
 */
export function ordersAsFinance(orders: Order[]): { service_name: string; price: number; status: string; starts_at: string; ends_at: string }[] {
  const far = '2999-12-31T00:00:00.000Z';
  return orders.map((o) => ({
    service_name: `${o.fulfillment === 'ENTREGA' ? 'Entregas' : 'Retiradas'} · ${o.source === 'WHATSAPP' ? 'atendente IA' : 'painel'}`,
    price: o.total,
    status: SOLD_STATUSES.includes(o.status) ? 'COMPLETED' : o.status === 'CANCELADO' ? 'CANCELLED' : 'CONFIRMED',
    starts_at: o.created_at,
    ends_at: o.status === 'NOVO' ? far : o.created_at,
  }));
}

/** Pedidos vendidos no formato da inteligência de vendas (meio a meio divide entre os sabores). */
export function ordersAsSales(orders: Order[]): { at: string; customerKey: string; items: { name: string; quantity: number; revenue: number }[] }[] {
  return orders
    .filter((o) => SOLD_STATUSES.includes(o.status))
    .map((o) => ({
      at: o.created_at,
      customerKey: phoneKey(o.customer_phone),
      items: (o.items || []).flatMap((l) => {
        const flavors = l.flavors?.length ? l.flavors : [l.description];
        return flavors.map((f) => ({ name: f, quantity: l.quantity / flavors.length, revenue: Number(l.total || 0) / flavors.length }));
      }),
    }));
}

export type ImprovementTip = { title: string; text: string; href: string | null; action: string | null };

/**
 * Onde melhorar (regras fixas): aparece na tela de Vendas na hora, sem
 * esperar a IA. As Dicas da semana usam a IA em cima destes mesmos números.
 */
export function improvementTips(m: OrderMetrics, ctx: { assistantEnabled: boolean; menuItems: number; afterHoursMessages?: number }): ImprovementTip[] {
  const tips: ImprovementTip[] = [];
  if (ctx.menuItems === 0) {
    tips.push({
      title: 'Cadastre o cardápio',
      text: 'Sem cardápio a atendente não consegue anotar pedidos. Comece pelos itens mais vendidos e as bebidas.',
      href: '/cardapio',
      action: 'Abrir o cardápio',
    });
  }
  if (!ctx.assistantEnabled && ctx.menuItems > 0) {
    tips.push({
      title: 'Ligue a atendente IA',
      text: 'Com ela ligada, cada mensagem no WhatsApp vira pedido anotado na hora, inclusive no pico de sexta e sábado.',
      href: '/atendente',
      action: 'Ligar a atendente',
    });
  }
  if (m.lapsed.count >= 5) {
    tips.push({
      title: `${m.lapsed.count} clientes sumiram`,
      text: `Pediram antes e não pedem há mais de ${LAPSED_MIN_DAYS} dias. Um cupom de retorno costuma trazer parte deles de volta.`,
      href: '/disparos?publico=sumidos&fonte=pedidos',
      action: 'Mandar campanha',
    });
  }
  const best = m.weekdays.find((d) => d.label === m.bestWeekday);
  const weak = m.weekdays.find((d) => d.label === m.weakestWeekday);
  if (best && weak && weak.orders <= best.orders / 2) {
    tips.push({
      title: `Movimente a ${weak.label.toLowerCase()}`,
      text: `${weak.label} teve ${weak.orders} pedidos e ${best.label.toLowerCase()} teve ${best.orders}. Uma promoção só para o dia fraco (ex.: "${weak.label.toLowerCase()} em dobro") movimenta a cozinha.`,
      href: '/disparos',
      action: 'Criar campanha',
    });
  }
  if (m.cancelRate >= 8 && m.cancelled >= 3) {
    tips.push({
      title: 'Muitos cancelamentos',
      text: `${m.cancelRate}% dos pedidos foram cancelados (${formatBRL(m.lostRevenue)} perdidos). Confira o motivo de cada um em Pedidos.`,
      href: '/pedidos',
      action: 'Ver pedidos',
    });
  }
  if (m.slowAccept >= 3) {
    tips.push({
      title: 'Aceite os pedidos mais rápido',
      text: `${m.slowAccept} pedidos esperaram mais de 10 minutos para serem aceitos. Deixe o quadro de Pedidos aberto e o aviso no celular ligado.`,
      href: '/pedidos',
      action: 'Abrir o quadro',
    });
  }
  if (m.avgDeliveryMinutes != null && m.avgDeliveryMinutes > 60) {
    tips.push({
      title: 'Entrega demorando',
      text: `A entrega leva em média ${m.avgDeliveryMinutes} minutos. Avise o tempo real na configuração de entrega para não frustrar o cliente.`,
      href: '/cardapio?aba=entrega',
      action: 'Ajustar tempo',
    });
  }
  if (m.orders >= 10 && m.averageTicket > 0) {
    const drinks = m.categories.find((c) => c.category === 'Bebidas');
    const share = drinks ? drinks.quantity / m.orders : 0;
    if (share < 0.4) {
      tips.push({
        title: 'Venda mais bebidas',
        text: `Só ${Math.round(share * 100)} bebidas a cada 100 pedidos. Um combo com bebida aumenta o ticket médio (hoje ${formatBRL(m.averageTicket)}).`,
        href: '/cardapio',
        action: 'Criar combo',
      });
    }
  }
  if (m.customers.unique >= 10 && m.customers.repeatRate < 15) {
    tips.push({
      title: 'Faça o cliente voltar',
      text: `Só ${m.customers.repeatRate}% dos clientes pediram mais de uma vez no período. Um cartão fidelidade pelo WhatsApp ("a 10ª é grátis") ajuda.`,
      href: '/disparos',
      action: 'Criar campanha',
    });
  }
  if (!tips.length) {
    tips.push({
      title: 'Tudo em dia',
      text: 'Nenhum ponto de atenção nos números do período. Continue registrando os pedidos para as dicas ficarem mais precisas.',
      href: null,
      action: null,
    });
  }
  return tips.slice(0, 4);
}
