/**
 * O que cada plano entrega, por ramo — a MESMA lista no onboarding e na
 * Assinatura. Só entra aqui o que o sistema faz hoje (nada de "em breve").
 * Ao lançar um recurso ou mudar um limite, atualize aqui.
 */
import {
  getPlanAiQuestionLimit,
  getPlanAssistantConversationLimit,
  PLAN_DISPATCH_LIMITS,
  PLAN_PROPERTY_LIMITS,
  PLAN_USER_LIMITS,
  type PlanTier,
} from '@/lib/planLimits';
import { hasFollowUp, isDispatchOnlySegment, isRealEstateSegment } from '@/lib/segmentConfig';
import { schedulingVerticalOf } from '@/lib/schedulingVerticals';
import { isPizzeriaSegment } from '@/lib/pizzeria';

type Kind = 'imobiliario' | 'agenda' | 'pizzaria' | 'disparos' | 'geral';

function kindOf(segment: string | null | undefined): Kind {
  if (isRealEstateSegment(segment ?? null)) return 'imobiliario';
  if (schedulingVerticalOf(segment)) return 'agenda';
  if (isPizzeriaSegment(segment)) return 'pizzaria';
  if (isDispatchOnlySegment(segment ?? null)) return 'disparos';
  return 'geral';
}

const n = (value: number) => value.toLocaleString('pt-BR');

const BLURBS: Record<Kind, Record<PlanTier, string>> = {
  imobiliario: {
    STARTER: 'A atendente faz o primeiro atendimento e passa o cliente qualificado para o corretor.',
    PRO: 'A atendente conduz a conversa até o pedido de visita, e a inteligência de demanda mostra o que seus clientes procuram.',
    ENTERPRISE: 'Tudo do Pro com volume alto, equipe grande e acompanhamento próximo da Domu.',
  },
  agenda: {
    STARTER: 'Agenda e atendente IA para receber horários pelo WhatsApp a qualquer hora.',
    PRO: 'Inteligência de vendas e dicas da semana com IA, mais conversas da atendente e equipe maior.',
    ENTERPRISE: 'Volume alto, equipe grande e acompanhamento próximo da Domu.',
  },
  pizzaria: {
    STARTER: 'Para pizzaria, hamburgueria, dogão, açaí, marmita: atendente IA que anota pedidos no WhatsApp e quadro de pedidos para a cozinha.',
    PRO: 'Inteligência de vendas (o que vende em cada dia, combos) e dicas com IA, mais conversas para as noites cheias.',
    ENTERPRISE: 'Volume alto de pedidos, equipe grande e acompanhamento próximo da Domu.',
  },
  disparos: {
    STARTER: 'Campanhas pelo WhatsApp oficial, sem cadastros complexos. Quando crescer, faça upgrade.',
    PRO: 'Ativa as ferramentas do seu ramo, com mais volume e equipe maior.',
    ENTERPRISE: 'Ativa as ferramentas do seu ramo, com volume alto e acompanhamento próximo.',
  },
  geral: {
    STARTER: 'Campanhas oficiais pelo WhatsApp da Meta, com trava diária de segurança.',
    PRO: 'Mais volume e equipe maior para operações em crescimento.',
    ENTERPRISE: 'Volume alto, equipe grande e acompanhamento próximo da Domu.',
  },
};

/** Recursos do ramo (vêm primeiro: é o que diferencia). */
/** Inteligência de vendas (Pro e Enterprise), escrita do jeito de cada ramo. */
const INTELLIGENCE: Partial<Record<Kind, string[]>> = {
  agenda: [
    'Inteligência de vendas: qual serviço sai mais em cada dia da semana, quais serviços o mesmo cliente costuma fazer juntos e o que subiu ou caiu',
    'Dicas da semana escritas pela IA com o que fazer para vender mais (painel, e-mail e WhatsApp)',
  ],
  pizzaria: [
    'Inteligência de vendas: o que mais vende em cada dia da semana e horário, o que sai junto (para montar combos) e o que subiu ou caiu',
    'Onde melhorar + Dicas da semana escritas pela IA com o que fazer para vender mais (painel, e-mail e WhatsApp)',
  ],
  imobiliario: [
    'Inteligência de demanda: o que os clientes mais procuram (tipo, bairro, faixa de valor), em que dia chegam e quais imóveis faltam no catálogo',
  ],
};

function segmentFeatures(kind: Kind, tier: PlanTier, segment: string | null | undefined): string[] {
  const conversations = n(getPlanAssistantConversationLimit(tier, segment));
  const intelligence =
    tier === 'STARTER' || !INTELLIGENCE[kind]
      ? []
      : [...INTELLIGENCE[kind]!, `Pergunte para a IA sobre os seus números (${n(getPlanAiQuestionLimit(tier))} perguntas/mês)`];
  if (kind === 'imobiliario') {
    return [
      tier === 'STARTER'
        ? `Atendente IA de primeiro atendimento: entende o cliente, mostra os imóveis e passa para o corretor (${conversations} conversas/mês)`
        : `Atendente IA completa: tira dúvidas sobre os imóveis e anota pedidos de visita (${conversations} conversas/mês)`,
      `Catálogo com até ${n(PLAN_PROPERTY_LIMITS[tier])} imóveis ativos`,
      'Leads com o perfil de interesse e o resumo da atendente',
      ...(tier === 'STARTER' ? [] : ['Pedidos de visita para o corretor confirmar']),
      ...intelligence,
    ];
  }
  if (kind === 'agenda') {
    return [
      `Atendente IA que apresenta os serviços e agenda sozinha (${conversations} conversas/mês)`,
      'Agenda com serviços, horários e atendimentos simultâneos',
      'Lembrete automático para o cliente antes do horário',
      'Financeiro: faturamento da agenda, gastos e lucro',
      ...intelligence,
    ];
  }
  if (kind === 'pizzaria') {
    return [
      `Atendente IA que mostra o cardápio e anota o pedido com o valor calculado pelo sistema (${conversations} conversas/mês)`,
      'Quadro de pedidos com aviso de status ao cliente (em preparo, saiu para entrega, pronto)',
      'Cardápio com tamanhos, meio a meio, taxa por bairro e pedido mínimo',
      'Vendas e métricas: faturamento, mais vendidos, horários de pico, ticket médio e clientes que sumiram',
      'Financeiro: faturamento dos pedidos, gastos e lucro',
      ...intelligence,
    ];
  }
  if (kind === 'disparos' && tier !== 'STARTER') {
    return ['Ativa as ferramentas do seu ramo (atendente IA, agenda ou imóveis)'];
  }
  return [];
}

/** Lista do card do plano para o ramo da conta. */
export function planFeatures(segment: string | null | undefined, tier: PlanTier): string[] {
  const kind = kindOf(segment);
  const limits = PLAN_DISPATCH_LIMITS[tier];
  return [
    ...segmentFeatures(kind, tier, segment),
    limits.labelMonthly,
    limits.labelDaily ?? 'Sem teto diário na plataforma',
    `Até ${PLAN_USER_LIMITS[tier]} usuários na conta`,
    'WhatsApp oficial da Meta, junto com o app do celular (coexistência)',
    'Campanhas com acompanhamento de envio, entrega e leitura',
    'Contatos salvos sozinhos, importação e etiquetas',
    ...(hasFollowUp(segment ?? null) ? ['Follow-up automático para quem não respondeu'] : []),
    'Resultados e relatório de envios',
    ...(tier === 'PRO' ? ['Suporte prioritário da Domu'] : []),
    ...(tier === 'ENTERPRISE' ? ['Suporte prioritário da Domu', 'Onboarding assistido pela Domu', 'Gerente de conta dedicado'] : []),
  ];
}

export function planBlurb(segment: string | null | undefined, tier: PlanTier): string {
  return BLURBS[kindOf(segment)][tier];
}
