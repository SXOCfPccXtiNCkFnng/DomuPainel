/**
 * Ferramentas da atendente de IA do delivery de comida. Tudo validado aqui no
 * servidor: o valor do pedido sai do cardápio (priceOrder), nunca da IA, e o
 * pedido só é gravado para o contato desta conversa.
 */
import { logger } from '@/lib/logger';
import { notifyTenantAdmins } from '@/lib/notify';
import { handOffToTeam, type HandoffContext } from '@/lib/assistantTools';
import { createOrder, loadCustomerOrders } from '@/lib/pizzeriaServer';
import {
  cleanText,
  formatBRL,
  isOpenAt,
  normalizeName,
  ORDER_STATUS_LABELS,
  orderSummaryText,
  parseMoney,
  pricesLabel,
  priceOrder,
  type Fulfillment,
  type MenuItem,
  type OrderItemInput,
  type OrderLine,
  type PizzeriaSettings,
  type PricedOrder,
} from '@/lib/pizzeria';

export type PizzeriaToolContext = HandoffContext & {
  menu: MenuItem[];
  pizzeria: PizzeriaSettings;
  showPrices: boolean;
  paymentMethods: string[];
};

type ToolResult = Record<string, unknown>;
const STRING = 'STRING';

const ITEMS_SCHEMA = {
  type: 'ARRAY',
  description: 'Itens do pedido.',
  items: {
    type: 'OBJECT',
    properties: {
      item: { type: STRING, description: 'Nome do item no cardápio (lanche, pizza de um sabor, açaí, bebida, adicional...).' },
      sabores: {
        type: 'ARRAY',
        items: { type: STRING },
        description: 'Só para pizza meio a meio: os sabores (nomes do cardápio). Deixe vazio se for um sabor só.',
      },
      tamanho: { type: STRING, description: 'Tamanho (ex.: Broto, Média, Grande), se o item tiver tamanhos.' },
      quantidade: { type: 'INTEGER', description: 'Quantidade (padrão 1).' },
      observacao: { type: STRING, description: 'Observação do cliente para este item (ex.: sem cebola).' },
    },
  },
};

const ORDER_PROPS = {
  itens: ITEMS_SCHEMA,
  tipo: { type: STRING, enum: ['entrega', 'retirada'], description: 'Entrega ou retirada no local.' },
  bairro: { type: STRING, description: 'Bairro da entrega (obrigatório para entrega).' },
};

export function pizzeriaToolDeclarations() {
  return [
    {
      name: 'ver_cardapio',
      description: 'Busca itens do cardápio por nome ou categoria (use para confirmar sabores, tamanhos e descrição).',
      parameters: {
        type: 'OBJECT',
        properties: {
          busca: { type: STRING, description: 'Nome, ingrediente ou categoria (ex.: calabresa, bebidas, doce).' },
        },
      },
    },
    {
      name: 'calcular_pedido',
      description:
        'Confere os itens no cardápio e calcula subtotal, taxa de entrega e total. Use sempre antes de mostrar o resumo ao cliente.',
      parameters: { type: 'OBJECT', properties: ORDER_PROPS, required: ['itens', 'tipo'] },
    },
    {
      name: 'registrar_pedido',
      description:
        'Registra o pedido para a cozinha. Só use depois que o cliente confirmar o resumo de calcular_pedido, com os mesmos itens.',
      parameters: {
        type: 'OBJECT',
        properties: {
          ...ORDER_PROPS,
          endereco: { type: STRING, description: 'Endereço completo com número e complemento (entrega).' },
          pagamento: { type: STRING, description: 'Forma de pagamento escolhida.' },
          troco_para: { type: 'NUMBER', description: 'Se for dinheiro: troco para quanto (em reais).' },
          nome_cliente: { type: STRING, description: 'Nome do cliente.' },
          observacoes: { type: STRING, description: 'Observação geral do pedido, se houver.' },
        },
        required: ['itens', 'tipo', 'pagamento', 'nome_cliente'],
      },
    },
    {
      name: 'status_pedido',
      description: 'Mostra o status dos pedidos recentes deste cliente.',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'chamar_equipe',
      description:
        'Passa a conversa para alguém da equipe (reclamação, atraso, pedido errado, mudar ou cancelar pedido, alergia, pedido grande/festa, ou pedido para falar com uma pessoa). Depois disso você para de responder esta conversa.',
      parameters: {
        type: 'OBJECT',
        properties: { motivo: { type: STRING, description: 'Resumo curto do motivo, em português.' } },
        required: ['motivo'],
      },
    },
  ];
}

function fulfillmentOf(value: unknown): Fulfillment | null {
  const v = normalizeName(value);
  if (v.startsWith('entreg') || v === 'delivery') return 'ENTREGA';
  if (v.startsWith('retir') || v.includes('balcao') || v.includes('buscar')) return 'RETIRADA';
  return null;
}

function verCardapio(args: Record<string, unknown>, ctx: PizzeriaToolContext): ToolResult {
  const q = normalizeName(args.busca);
  const active = ctx.menu.filter((m) => m.active);
  const hits = q
    ? active.filter((m) => normalizeName(`${m.name} ${m.category} ${m.description || ''}`).includes(q))
    : active.filter((m) => m.featured);
  const list = (hits.length ? hits : active.filter((m) => m.featured)).slice(0, 15);
  return {
    itens: list.map((m) => ({
      nome: m.name,
      categoria: m.category,
      descricao: m.description || undefined,
      ...(ctx.showPrices ? { precos: pricesLabel(m.prices) } : { tamanhos: m.prices.map((p) => p.size).filter(Boolean) }),
      meio_a_meio: m.allows_half || undefined,
      mais_pedida: m.featured || undefined,
    })),
    ...(hits.length ? {} : { observacao: q ? 'Nada com esse nome no cardápio. Diga que não tem e mostre opções.' : undefined }),
  };
}

function priceFromArgs(args: Record<string, unknown>, ctx: PizzeriaToolContext) {
  const fulfillment = fulfillmentOf(args.tipo);
  if (!fulfillment) return { ok: false as const, error: 'Pergunte se é entrega ou retirada.' };
  const items = (Array.isArray(args.itens) ? args.itens : []) as OrderItemInput[];
  const priced = priceOrder({ menu: ctx.menu, settings: ctx.pizzeria, items, fulfillment, area: args.bairro });
  return priced.ok ? { ok: true as const, priced: priced.order, fulfillment } : { ok: false as const, error: priced.error };
}

function calcularPedido(args: Record<string, unknown>, ctx: PizzeriaToolContext): ToolResult {
  const r = priceFromArgs(args, ctx);
  if (!r.ok) return { ok: false, erro: r.error };
  return {
    ok: true,
    resumo: orderSummaryText(r.priced),
    total: formatBRL(r.priced.total),
    observacao: 'Mostre este resumo ao cliente e peça para confirmar antes de registrar.',
  };
}

/** Mesmos itens (quantidade, descrição e observação), em qualquer ordem. */
export function orderSignature(lines: Pick<OrderLine, 'quantity' | 'description' | 'notes'>[]): string {
  return lines
    .map((l) => `${l.quantity}x ${l.description}|${l.notes || ''}`)
    .sort()
    .join(';');
}

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

async function findRecentSameOrder(ctx: PizzeriaToolContext, priced: PricedOrder) {
  const recent = await loadCustomerOrders(ctx.tenantId, ctx.leadPhone, 3);
  const signature = orderSignature(priced.lines);
  return (
    recent.find(
      (o) =>
        o.status === 'NOVO' &&
        ctx.now.getTime() - new Date(o.created_at).getTime() < DUPLICATE_WINDOW_MS &&
        o.total === priced.total &&
        orderSignature(o.items) === signature
    ) ?? null
  );
}

async function registrarPedido(args: Record<string, unknown>, ctx: PizzeriaToolContext): Promise<ToolResult> {
  if (!isOpenAt(ctx.now, ctx.pizzeria.weekly_hours)) {
    return { ok: false, erro: 'A loja está fechada agora. Não registre: diga o horário de funcionamento.' };
  }
  const r = priceFromArgs(args, ctx);
  if (!r.ok) return { ok: false, erro: r.error };
  const address = cleanText(args.endereco, 400) || null;
  if (r.fulfillment === 'ENTREGA' && (!address || address.length < 8 || !/\d/.test(address))) {
    return { ok: false, erro: 'Peça o endereço completo da entrega, com número.' };
  }
  const payment = cleanText(args.pagamento, 40);
  if (!payment) return { ok: false, erro: 'Pergunte a forma de pagamento.' };
  const change = parseMoney(args.troco_para);
  if (change === 'invalid') return { ok: false, erro: 'Não entendi o valor do troco. Pergunte de novo para quanto é o troco.' };
  // Troco menor que o total não serve para a entrega: confirma em vez de sumir com a informação.
  if (change != null && change > 0 && change <= r.priced.total) {
    return {
      ok: false,
      erro: `O troco precisa ser para um valor maior que o total (${formatBRL(r.priced.total)}). Confirme com o cliente para quanto é o troco, ou se ele não precisa de troco.`,
    };
  }
  const changeFor = change != null && change > r.priced.total ? change : null;
  const name = cleanText(args.nome_cliente, 120) || ctx.leadName;

  // A IA chamou registrar duas vezes (mesma conversa, mesmos itens, poucos minutos): não manda duas pizzas para a cozinha.
  const duplicate = await findRecentSameOrder(ctx, r.priced);
  if (duplicate) {
    return {
      ok: true,
      pedido: {
        numero: duplicate.order_number,
        total: formatBRL(duplicate.total),
        tipo: duplicate.fulfillment === 'ENTREGA' ? 'entrega' : 'retirada',
      },
      observacao: `Este pedido já estava registrado como #${duplicate.order_number}. Não registre de novo: só diga o número ao cliente.`,
    };
  }

  const order = await createOrder({
    tenantId: ctx.tenantId,
    leadId: ctx.leadId,
    customerName: name,
    customerPhone: ctx.leadPhone,
    priced: r.priced,
    fulfillment: r.fulfillment,
    address: r.fulfillment === 'ENTREGA' ? address : null,
    paymentMethod: payment,
    changeFor,
    notes: cleanText(args.observacoes, 500) || null,
    source: 'WHATSAPP',
  });

  await notifyTenantAdmins(ctx.tenantId, {
    title: `Novo pedido #${order.order_number} pelo WhatsApp`,
    message: `${name} · ${formatBRL(order.total)} · ${r.fulfillment === 'ENTREGA' ? `entrega${order.area ? ` (${order.area})` : ''}` : 'retirada'}. Aceite o pedido no quadro.`,
    type: 'SUCCESS',
    url: '/pedidos',
  });
  logger.info('assistant.order_created', { tenantId: ctx.tenantId, orderId: order.id, total: order.total });
  return {
    ok: true,
    pedido: { numero: order.order_number, total: formatBRL(order.total), tipo: r.fulfillment === 'ENTREGA' ? 'entrega' : 'retirada' },
    observacao: `Pedido #${order.order_number} registrado. Diga o número e que a loja vai confirmar e avisar por aqui. Não diga que já está confirmado.`,
  };
}

async function statusPedido(ctx: PizzeriaToolContext): Promise<ToolResult> {
  const orders = await loadCustomerOrders(ctx.tenantId, ctx.leadPhone, 3);
  if (!orders.length) return { pedidos: [], observacao: 'Nenhum pedido deste cliente.' };
  return {
    pedidos: orders.map((o) => ({
      numero: o.order_number,
      status: ORDER_STATUS_LABELS[o.status],
      total: formatBRL(o.total),
      feito_em: new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(o.created_at)),
    })),
    observacao: 'Se o cliente reclamar de atraso, peça desculpas e use chamar_equipe.',
  };
}

export async function executePizzeriaTool(name: string, args: Record<string, unknown>, ctx: PizzeriaToolContext): Promise<ToolResult> {
  switch (name) {
    case 'ver_cardapio':
      return verCardapio(args, ctx);
    case 'calcular_pedido':
      return calcularPedido(args, ctx);
    case 'registrar_pedido':
      return registrarPedido(args, ctx);
    case 'status_pedido':
      return statusPedido(ctx);
    case 'chamar_equipe': {
      const result = await handOffToTeam(ctx, cleanText(args.motivo, 250) || 'Cliente precisa de atendimento', '/pedidos');
      return {
        ...result,
        observacao: 'Equipe avisada. Diga ao cliente que alguém da loja responde por aqui em instantes e encerre sem novas perguntas.',
      };
    }
    default:
      return { erro: `Ferramenta desconhecida: ${name}` };
  }
}
