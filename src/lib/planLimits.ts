export type PlanTier = 'STARTER' | 'PRO' | 'ENTERPRISE';

export const PLAN_PRICES_BRL: Record<PlanTier, number> = {
  STARTER: 197,
  PRO: 497,
  ENTERPRISE: 997,
};

/** Soft limits enforced by DOMU (independent from Meta Cloud API tiers). */
export const PLAN_DISPATCH_LIMITS: Record<
  PlanTier,
  { monthly: number; daily: number | null; labelMonthly: string; labelDaily: string | null }
> = {
  STARTER: {
    monthly: 1500,
    daily: 200,
    labelMonthly: 'Até 1.500 disparos/mês (limite DOMU)',
    labelDaily: 'Até 200 disparos/dia (trava de segurança)',
  },
  PRO: {
    monthly: 6000,
    daily: null,
    labelMonthly: 'Até 6.000 disparos/mês (limite DOMU)',
    labelDaily: null,
  },
  ENTERPRISE: {
    monthly: 999999,
    daily: null,
    labelMonthly: 'Disparos ilimitados no portal (sujeito à Meta)',
    labelDaily: null,
  },
};

export function normalizePlanTier(planTier: string | null | undefined): PlanTier {
  if (planTier === 'PRO' || planTier === 'ENTERPRISE' || planTier === 'STARTER') {
    return planTier;
  }
  return 'STARTER';
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

/** Limite de usuários por tenant (ADMIN + convites). */
export const PLAN_USER_LIMITS: Record<PlanTier, number> = {
  STARTER: 3,
  PRO: 10,
  ENTERPRISE: 50,
};

export function getPlanUserLimit(planTier: string | null | undefined): number {
  return PLAN_USER_LIMITS[normalizePlanTier(planTier)];
}
