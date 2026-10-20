/**
 * Ferramentas da atendente de IA imobiliária. Tudo validado aqui no servidor:
 * a IA só busca no catálogo desta conta e só grava no lead desta conversa.
 */
import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { notifyTenantAdmins } from '@/lib/notify';
import { handOffToTeam, type HandoffContext } from '@/lib/assistantTools';
import {
  normalizeSearch,
  OFFERABLE_STATUSES,
  propertyForAI,
  searchProperties,
  type RealEstateMode,
  type RealEstateProperty,
} from '@/lib/realEstate';

export type RealEstateToolContext = HandoffContext & {
  mode: RealEstateMode;
  showPrices: boolean;
  properties: RealEstateProperty[];
};

type ToolResult = Record<string, unknown>;

const STRING = 'STRING';

const SEARCH_PROPS = {
  finalidade: { type: STRING, enum: ['comprar', 'alugar'], description: 'Se o cliente quer comprar ou alugar.' },
  tipo: { type: STRING, description: 'Tipo de imóvel (casa, apartamento, terreno, comercial...).' },
  regiao: { type: STRING, description: 'Bairro, região ou cidade que o cliente quer.' },
  valor_maximo: { type: 'NUMBER', description: 'Valor máximo em reais (aluguel: valor mensal).' },
  quartos_minimo: { type: 'INTEGER', description: 'Mínimo de quartos.' },
};

const BASE_DECLARATIONS = [
  {
    name: 'buscar_imoveis',
    description:
      'Busca imóveis disponíveis do catálogo que combinam com o que o cliente procura. Use antes de falar de qualquer imóvel. Todos os campos são opcionais.',
    parameters: { type: 'OBJECT', properties: SEARCH_PROPS },
  },
  {
    name: 'detalhes_imovel',
    description: 'Todos os detalhes de um imóvel do catálogo pelo código (características, descrição, link com fotos).',
    parameters: {
      type: 'OBJECT',
      properties: { codigo: { type: STRING, description: 'Código do imóvel, como veio da busca.' } },
      required: ['codigo'],
    },
  },
  {
    name: 'registrar_interesse',
    description:
      'Salva o que o cliente procura no cadastro dele (para o corretor e para avisar de imóveis novos). Use sempre que aprender algo novo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        ...SEARCH_PROPS,
        imovel_codigo: { type: STRING, description: 'Código do imóvel em que o cliente se interessou, se houver.' },
        resumo: {
          type: STRING,
          description: 'Resumo curto para o corretor: o que procura, prazo, se vai financiar, observações.',
        },
      },
    },
  },
  {
    name: 'chamar_corretor',
    description:
      'Passa a conversa para um corretor (interesse num imóvel, visita no plano de primeiro atendimento, negociação, financiamento, documentação, proprietário querendo vender/alugar/anunciar, cliente atual com boleto/contrato/manutenção, reclamação ou pedido para falar com alguém). Depois disso você para de responder esta conversa.',
    parameters: {
      type: 'OBJECT',
      properties: {
        motivo: { type: STRING, description: 'Resumo curto do motivo, em português.' },
        imovel_codigo: { type: STRING, description: 'Código do imóvel em questão, se houver.' },
      },
      required: ['motivo'],
    },
  },
];

const VISIT_DECLARATION = {
  name: 'solicitar_visita',
  description:
    'Registra o pedido de visita para o corretor confirmar. Só use depois que o cliente confirmar o imóvel, a preferência de dia/horário e o nome.',
  parameters: {
    type: 'OBJECT',
    properties: {
      imovel_codigo: { type: STRING, description: 'Código do imóvel.' },
      preferencia: { type: STRING, description: 'Dia e horário/período que o cliente prefere (ex.: sábado de manhã).' },
      nome_cliente: { type: STRING, description: 'Nome do cliente.' },
      observacoes: { type: STRING, description: 'Observações do cliente, se houver.' },
    },
    required: ['imovel_codigo', 'preferencia', 'nome_cliente'],
  },
};

/** Primeiro atendimento (Starter) não tem pedido de visita: isso é com o corretor. */
export function realEstateToolDeclarations(mode: RealEstateMode) {
  return mode === 'COMPLETO' ? [...BASE_DECLARATIONS, VISIT_DECLARATION] : BASE_DECLARATIONS;
}

function text(value: unknown, max: number): string {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function positiveNumber(value: unknown, max: number): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= max ? n : null;
}

function purposeOf(value: unknown): 'VENDA' | 'ALUGUEL' | null {
  const v = normalizeSearch(value);
  if (v.startsWith('alug')) return 'ALUGUEL';
  if (v.startsWith('compr') || v === 'venda') return 'VENDA';
  return null;
}

function findByCode(ctx: RealEstateToolContext, code: unknown): RealEstateProperty | null {
  const wanted = normalizeSearch(code).replace(/\s+/g, '');
  if (!wanted) return null;
  return ctx.properties.find((p) => normalizeSearch(p.code).replace(/\s+/g, '') === wanted) || null;
}

function buscarImoveis(args: Record<string, unknown>, ctx: RealEstateToolContext): ToolResult {
  const purpose = purposeOf(args.finalidade);
  const result = searchProperties(ctx.properties, {
    purpose,
    type: text(args.tipo, 60) || null,
    location: text(args.regiao, 100) || null,
    priceMax: positiveNumber(args.valor_maximo, 999_999_999),
    bedroomsMin: positiveNumber(args.quartos_minimo, 50),
  });
  const show = (list: RealEstateProperty[]) => list.map((p) => propertyForAI(p, { showPrices: ctx.showPrices }));
  if (result.exact.length) return { imoveis: show(result.exact) };
  if (result.similar.length) {
    return {
      imoveis: [],
      parecidos: show(result.similar),
      observacao: 'Nada exatamente no pedido. Estes são parecidos: diga ao cliente o que muda em cada um.',
    };
  }
  return {
    imoveis: [],
    observacao: 'Nenhum imóvel disponível nesse perfil. Diga que no momento não tem e registre o interesse.',
  };
}

function detalhesImovel(args: Record<string, unknown>, ctx: RealEstateToolContext): ToolResult {
  const p = findByCode(ctx, args.codigo);
  if (!p) return { erro: 'Imóvel não encontrado. Use o código exatamente como veio da busca.' };
  if (!OFFERABLE_STATUSES.includes(p.status)) {
    return { indisponivel: true, situacao: p.status, observacao: 'Este imóvel não está mais disponível. Ofereça buscar outros parecidos.' };
  }
  return { imovel: propertyForAI(p, { showPrices: ctx.showPrices, details: true }) };
}

async function registrarInteresse(args: Record<string, unknown>, ctx: RealEstateToolContext): Promise<ToolResult> {
  const patch: Record<string, unknown> = {};
  const purpose = purposeOf(args.finalidade);
  if (purpose) patch.interest_purpose = purpose;
  const type = text(args.tipo, 50);
  if (type) patch.interest_property_type = type;
  const region = text(args.regiao, 100);
  if (region) patch.region = region;
  const budget = positiveNumber(args.valor_maximo, 999_999_999);
  if (budget) patch.budget_max = budget;
  const bedrooms = positiveNumber(args.quartos_minimo, 50);
  if (bedrooms) patch.bedrooms_min = Math.round(bedrooms);
  const summary = text(args.resumo, 600);
  if (summary) patch.ai_summary = summary;
  const property = args.imovel_codigo ? findByCode(ctx, args.imovel_codigo) : null;
  if (property) patch.interest_property_id = property.id;
  if (!Object.keys(patch).length) return { ok: false, erro: 'Nada para registrar.' };

  const { error } = await supabaseAdmin
    .from('leads')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', ctx.leadId)
    .eq('tenant_id', ctx.tenantId);
  if (error) throw error;

  // Cliente que começou a contar o que procura sai de "Novo".
  await supabaseAdmin
    .from('leads')
    .update({ status: 'EM_ATENDIMENTO' })
    .eq('id', ctx.leadId)
    .eq('tenant_id', ctx.tenantId)
    .or('status.is.null,status.eq.NOVO');

  return { ok: true };
}

async function chamarCorretor(args: Record<string, unknown>, ctx: RealEstateToolContext): Promise<ToolResult> {
  const property = args.imovel_codigo ? findByCode(ctx, args.imovel_codigo) : null;
  if (property) {
    await supabaseAdmin
      .from('leads')
      .update({ interest_property_id: property.id })
      .eq('id', ctx.leadId)
      .eq('tenant_id', ctx.tenantId);
  }
  const motivo = text(args.motivo, 250) || 'Cliente precisa de um corretor';
  const reason = property ? `${motivo} (imóvel ${property.code} · ${property.title})` : motivo;
  const result = await handOffToTeam(ctx, reason, '/leads');
  return {
    ...result,
    observacao:
      'Corretor avisado. Diga ao cliente que um corretor continua o atendimento por aqui, seguindo a regra do horário de atendimento, e encerre sem novas perguntas.',
  };
}

async function solicitarVisita(args: Record<string, unknown>, ctx: RealEstateToolContext): Promise<ToolResult> {
  if (ctx.mode !== 'COMPLETO') return { ok: false, erro: 'Pedido de visita é com o corretor: use chamar_corretor.' };
  const property = findByCode(ctx, args.imovel_codigo);
  if (!property) return { ok: false, erro: 'Imóvel não encontrado. Use o código exatamente como veio da busca.' };
  if (!OFFERABLE_STATUSES.includes(property.status)) return { ok: false, erro: 'Este imóvel não está mais disponível.' };
  const preferred = text(args.preferencia, 200);
  if (preferred.length < 3) return { ok: false, erro: 'Pergunte ao cliente o dia e o período de preferência.' };
  const name = text(args.nome_cliente, 120) || ctx.leadName;
  const notes = text(args.observacoes, 500) || null;
  const label = `${property.code} · ${property.title}`.slice(0, 300);

  // Mesmo imóvel pedido de novo (mudou a preferência): atualiza em vez de duplicar.
  const { data: existing } = await supabaseAdmin
    .from('visit_requests')
    .select('id')
    .eq('tenant_id', ctx.tenantId)
    .eq('lead_id', ctx.leadId)
    .eq('property_id', property.id)
    .eq('status', 'PENDING')
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();
  const { error } = existing
    ? await supabaseAdmin
        .from('visit_requests')
        .update({ preferred_time: preferred, customer_name: name, notes, updated_at: now })
        .eq('id', existing.id)
        .eq('tenant_id', ctx.tenantId)
    : await supabaseAdmin.from('visit_requests').insert({
        tenant_id: ctx.tenantId,
        lead_id: ctx.leadId,
        property_id: property.id,
        property_label: label,
        customer_name: name,
        customer_phone: ctx.leadPhone,
        preferred_time: preferred,
        notes,
      });
  if (error) throw error;

  await supabaseAdmin
    .from('leads')
    .update({ interest_property_id: property.id, updated_at: now })
    .eq('id', ctx.leadId)
    .eq('tenant_id', ctx.tenantId);

  await notifyTenantAdmins(ctx.tenantId, {
    title: 'Pedido de visita pelo WhatsApp',
    message: `${name} quer visitar ${label} — ${preferred}. Confirme o horário com o cliente.`,
    type: 'SUCCESS',
    url: '/visitas',
  });
  logger.info('assistant.visit_requested', { tenantId: ctx.tenantId, propertyId: property.id, updated: Boolean(existing) });
  return {
    ok: true,
    visita: { imovel: label, preferencia: preferred },
    observacao: 'Pedido registrado. Diga que o corretor vai confirmar o horário por aqui; não diga que está confirmada.',
  };
}

export async function executeRealEstateTool(
  name: string,
  args: Record<string, unknown>,
  ctx: RealEstateToolContext
): Promise<ToolResult> {
  switch (name) {
    case 'buscar_imoveis':
      return buscarImoveis(args, ctx);
    case 'detalhes_imovel':
      return detalhesImovel(args, ctx);
    case 'registrar_interesse':
      return registrarInteresse(args, ctx);
    case 'chamar_corretor':
      return chamarCorretor(args, ctx);
    case 'solicitar_visita':
      return solicitarVisita(args, ctx);
    default:
      return { erro: `Ferramenta desconhecida: ${name}` };
  }
}
