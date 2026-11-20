export type PlanTier = 'STARTER' | 'PRO' | 'ENTERPRISE';

export const PLAN_PRICES_BRL: Record<PlanTier, number> = {
  STARTER: 150,
  PRO: 297,
  ENTERPRISE: 597,
};

/**
 * Preço padrão de cada módulo (quando o /interno não tem um preço próprio
 * salvo para o ramo — o do banco sempre vence). Conta usada para chegar
 * nesses valores (custo da IA no preço cheio de 2027, por conversa:
 * agenda ~R$ 0,35, imobiliário ~R$ 0,45, alimentação ~R$ 0,40, + ~R$ 15 de
 * infraestrutura e taxa de cobrança por conta): margem de ~40% mesmo com a
 * cota de conversas 100% usada; no uso normal (metade da cota) fica perto de 70%.
 * Vale para cadastro novo e troca de plano; assinante atual só muda pelo
 * /interno (que avisa com 30 dias de antecedência).
 */
export const SEGMENT_PLAN_PRICES_BRL: Record<string, Partial<Record<PlanTier, number>>> = {
  // Porta de entrada: sem IA, custo quase zero (a Meta cobra direto do cliente).
  marketing_apenas: { STARTER: 97 },
  automotivo: { STARTER: 147, PRO: 327, ENTERPRISE: 697 },
  saude: { STARTER: 147, PRO: 327, ENTERPRISE: 697 },
  imobiliario: { STARTER: 197, PRO: 447, ENTERPRISE: 997 },
  alimentacao: { STARTER: 197, PRO: 447, ENTERPRISE: 1097 },
};

/** Soft limits enforced by DOMU (independent from Meta Cloud API tiers). */
export const PLAN_DISPATCH_LIMITS: Record<
  PlanTier,
  { monthly: number; daily: number | null; labelMonthly: string; labelDaily: string | null }
> = {
  STARTER: {
    monthly: 500,
    daily: 200,
    labelMonthly: 'Até 500 disparos/mês (limite DOMU)',
    labelDaily: 'Até 200 disparos/dia (trava de segurança)',
  },
  PRO: {
    monthly: 2000,
    daily: null,
    labelMonthly: 'Até 2.000 disparos/mês (limite DOMU)',
    labelDaily: null,
  },
  ENTERPRISE: {
    monthly: 6000,
    daily: null,
    labelMonthly: 'Até 6.000 disparos/mês (limite DOMU)',
    labelDaily: null,
  },
};

export function normalizePlanTier(planTier: string | null | undefined): PlanTier {
  if (planTier === 'PRO' || planTier === 'ENTERPRISE' || planTier === 'STARTER') {
    return planTier;
  }
  return 'STARTER';
}

const PLAN_DISPLAY_NAMES: Record<PlanTier, string> = {
  STARTER: 'Starter',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

/** Nome do plano para mostrar ao cliente (e-mails, avisos) — nunca o código "PRO". */
export function getPlanDisplayName(planTier: string | null | undefined): string {
  return PLAN_DISPLAY_NAMES[normalizePlanTier(planTier)];
}

export function getPlanMonthlyLimit(planTier: string | null | undefined): number {
  return PLAN_DISPATCH_LIMITS[normalizePlanTier(planTier)].monthly;
}

export function getPlanDailyLimit(planTier: string | null | undefined): number | null {
  return PLAN_DISPATCH_LIMITS[normalizePlanTier(planTier)].daily;
}

export function getPlanPrice(planTier: string | null | undefined): number {
  if (planTier === 'STARTER') return PLAN_PRICES_BRL.STARTER;
  if (planTier === 'ENTERPRISE') return PLAN_PRICES_BRL.ENTERPRISE;
  if (planTier === 'PRO') return PLAN_PRICES_BRL.PRO;
  return PLAN_PRICES_BRL.STARTER;
}

export function isUnlimitedPlanLimit(limit: number): boolean {
  return limit >= 100000;
}

/**
 * "Somente Disparos" é a porta de entrada: só existe no Starter. Ao assinar
 * Pro/Enterprise a conta vai para o módulo do RAMO dela (business_segment:
 * barbearia → saude, pizzaria → alimentacao...) — mesmo tenant,
 * contatos/campanhas/templates continuam.
 */
const DISPATCH_ONLY_SEGMENT = 'marketing_apenas';
const DISPATCH_ONLY_PLANS: PlanTier[] = ['STARTER'];
/** Ramo desconhecido (conta antiga sem business_segment): módulo genérico. */
export const UPGRADED_FROM_DISPATCH_SEGMENT = 'geral';

export function isPlanAllowedForSegment(
  segment: string | null | undefined,
  planTier: string | null | undefined
): boolean {
  if (segment !== DISPATCH_ONLY_SEGMENT) return true;
  return DISPATCH_ONLY_PLANS.includes(normalizePlanTier(planTier));
}

/** Segmento que a conta deve ter depois de ativar `planTier`. */
export function segmentAfterPlanActivation(
  segment: string | null | undefined,
  planTier: string | null | undefined,
  businessSegment?: string | null
): string | null {
  if (isPlanAllowedForSegment(segment, planTier)) return segment ?? null;
  if (businessSegment && businessSegment !== DISPATCH_ONLY_SEGMENT) return businessSegment;
  return UPGRADED_FROM_DISPATCH_SEGMENT;
}

/** Limite de usuários por tenant (ADMIN + convites). */
export const PLAN_USER_LIMITS: Record<PlanTier, number> = {
  STARTER: 2,
  PRO: 5,
  ENTERPRISE: 10,
};

export function getPlanUserLimit(planTier: string | null | undefined): number {
  return PLAN_USER_LIMITS[normalizePlanTier(planTier)];
}

/**
 * Conversas com a atendente de IA por mês. Conversa = um contato num dia
 * (horário de Brasília), não importa quantas mensagens troquem.
 */
export const PLAN_ASSISTANT_CONVERSATION_LIMITS: Record<PlanTier, number> = {
  STARTER: 150,
  PRO: 500,
  ENTERPRISE: 1200,
};

/**
 * Ramos com muito mais conversas por mês (delivery: cada pedido é uma
 * conversa, dezenas por noite) têm cota própria.
 */
export const SEGMENT_CONVERSATION_LIMITS: Record<string, Record<PlanTier, number>> = {
  alimentacao: { STARTER: 250, PRO: 700, ENTERPRISE: 1800 },
};

export function getPlanAssistantConversationLimit(
  planTier: string | null | undefined,
  segment?: string | null
): number {
  const tier = normalizePlanTier(planTier);
  return (segment && SEGMENT_CONVERSATION_LIMITS[segment]?.[tier]) || PLAN_ASSISTANT_CONVERSATION_LIMITS[tier];
}

/**
 * Inteligência de vendas (o que vende mais em cada dia da semana, o que sai
 * junto, dicas da semana com IA): só do Pro para cima.
 */
export function planHasSalesIntelligence(planTier: string | null | undefined): boolean {
  return normalizePlanTier(planTier) !== 'STARTER';
}

/** Perguntas por mês no "Pergunte para a IA" (custa ~R$ 0,05 cada no preço cheio). */
export const PLAN_AI_QUESTION_LIMITS: Record<PlanTier, number> = {
  STARTER: 0,
  PRO: 60,
  ENTERPRISE: 200,
};

export function getPlanAiQuestionLimit(planTier: string | null | undefined): number {
  return PLAN_AI_QUESTION_LIMITS[normalizePlanTier(planTier)];
}

/**
 * Imóveis ativos no catálogo (disponíveis + lançamentos: o que a atendente
 * oferece). Vendidos, alugados e reservados não contam — ficam de histórico.
 */
export const PLAN_PROPERTY_LIMITS: Record<PlanTier, number> = {
  STARTER: 30,
  PRO: 150,
  ENTERPRISE: 500,
};

export function getPlanPropertyLimit(planTier: string | null | undefined): number {
  return PLAN_PROPERTY_LIMITS[normalizePlanTier(planTier)];
}
