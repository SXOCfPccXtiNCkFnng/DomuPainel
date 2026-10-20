import { supabaseAdmin } from '@/lib/supabaseServer';
import { PLAN_PRICES_BRL, normalizePlanTier, PlanTier, segmentAfterPlanActivation } from '@/lib/planLimits';

export const PLAN_TIERS: PlanTier[] = ['STARTER', 'PRO', 'ENTERPRISE'];

/**
 * Preço vigente dos planos, editável no /interno.
 * - plan_prices: preço padrão (vale para todos os ramos);
 * - segment_plan_prices: preço próprio de um ramo, quando houver.
 * Cai para os valores de planLimits.ts se as tabelas ainda não existirem —
 * nunca quebra o checkout por causa disso.
 */
export async function getDefaultPlanPrices(): Promise<Record<PlanTier, number>> {
  const prices: Record<PlanTier, number> = { ...PLAN_PRICES_BRL };
  const { data, error } = await supabaseAdmin.from('plan_prices').select('plan_tier, price_brl');
  if (error || !data) return prices;
  for (const row of data) {
    const value = Number(row.price_brl);
    if (Number.isFinite(value) && value > 0) prices[normalizePlanTier(row.plan_tier)] = value;
  }
  return prices;
}

/** Preços próprios de cada ramo: { imobiliario: { PRO: 397 }, ... }. */
export async function getSegmentPriceOverrides(): Promise<Record<string, Partial<Record<PlanTier, number>>>> {
  const overrides: Record<string, Partial<Record<PlanTier, number>>> = {};
  const { data, error } = await supabaseAdmin.from('segment_plan_prices').select('segment, plan_tier, price_brl');
  if (error || !data) return overrides; // migration pendente: só o preço padrão
  for (const row of data) {
    const value = Number(row.price_brl);
    if (!Number.isFinite(value) || value <= 0) continue;
    (overrides[row.segment] ||= {})[normalizePlanTier(row.plan_tier)] = value;
  }
  return overrides;
}

/** Tabela de preços de um ramo (padrão + o que o ramo tiver de próprio). */
export async function getLivePlanPrices(segment?: string | null): Promise<Record<PlanTier, number>> {
  const prices = await getDefaultPlanPrices();
  if (!segment) return prices;
  const own = (await getSegmentPriceOverrides())[segment] || {};
  return { ...prices, ...own };
}

export async function getLivePlanPrice(planTier: string, segment?: string | null): Promise<number> {
  const prices = await getLivePlanPrices(segment);
  return prices[normalizePlanTier(planTier)];
}

/**
 * Preço de cada plano para uma conta: vale o ramo em que ela fica depois de
 * ativar o plano (quem sai do Somente Disparos paga o preço do ramo dela).
 */
export async function getPlanPricesFor(context: PricingContext): Promise<Record<PlanTier, number>> {
  const [defaults, overrides] = await Promise.all([getDefaultPlanPrices(), getSegmentPriceOverrides()]);
  return resolvePlanPrices(defaults, overrides, context);
}

export type PricingContext = { segment?: string | null; businessSegment?: string | null };

/** Regra pura: para cada plano, o preço próprio do ramo de destino ou o padrão. */
export function resolvePlanPrices(
  defaults: Record<PlanTier, number>,
  overrides: Record<string, Partial<Record<PlanTier, number>>>,
  context: PricingContext
): Record<PlanTier, number> {
  const prices = { ...defaults };
  for (const tier of PLAN_TIERS) {
    const segment = segmentAfterPlanActivation(context.segment, tier, context.businessSegment);
    const own = segment ? overrides[segment]?.[tier] : undefined;
    if (own) prices[tier] = own;
  }
  return prices;
}

/** Ramo e ramo de negócio gravados na conta (select('*'): business_segment pode não existir). */
export async function loadTenantSegments(tenantId: string): Promise<{ segment: string | null; businessSegment: string | null }> {
  const { data } = await supabaseAdmin.from('tenants').select('*').eq('id', tenantId).maybeSingle();
  const row = (data || {}) as { segment?: string | null; business_segment?: string | null };
  return { segment: row.segment ?? null, businessSegment: row.business_segment ?? null };
}

/** Preço do plano para a conta, com o ramo informado agora (onboarding/upgrade) por cima do gravado. */
export async function getTenantPlanPrice(
  tenantId: string,
  planTier: string,
  override?: { segment?: string | null; businessSegment?: string | null }
): Promise<number> {
  const saved = await loadTenantSegments(tenantId);
  const prices = await getPlanPricesFor({
    segment: override?.segment || saved.segment,
    businessSegment: override?.businessSegment || saved.businessSegment,
  });
  return prices[normalizePlanTier(planTier)];
}
