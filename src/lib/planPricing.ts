import { supabaseAdmin } from '@/lib/supabaseServer';
import { PLAN_PRICES_BRL, normalizePlanTier, PlanTier } from '@/lib/planLimits';

/**
 * Preço vigente dos planos, editável no /interno (tabela plan_prices).
 * Cai para os valores padrão de planLimits.ts se a tabela ainda não existir
 * ou não tiver linha pro plano — nunca quebra o checkout por causa disso.
 */
export async function getLivePlanPrices(): Promise<Record<PlanTier, number>> {
  const prices: Record<PlanTier, number> = { ...PLAN_PRICES_BRL };

  const { data, error } = await supabaseAdmin.from('plan_prices').select('plan_tier, price_brl');
  if (error || !data) return prices;

  for (const row of data) {
    const tier = normalizePlanTier(row.plan_tier);
    const value = Number(row.price_brl);
    if (Number.isFinite(value) && value > 0) prices[tier] = value;
  }
  return prices;
}

export async function getLivePlanPrice(planTier: string): Promise<number> {
  const prices = await getLivePlanPrices();
  return prices[normalizePlanTier(planTier)];
}
