/**
 * Cota mensal de conversas da atendente de IA (por plano). Conta as conversas
 * em assistant_runs; sem a tabela (migration pendente) não bloqueia ninguém.
 */
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getPlanAssistantConversationLimit, getPlanDisplayName, normalizePlanTier, type PlanTier } from '@/lib/planLimits';
import { brtDate, brtMonthStartIso, conversationKeys } from '@/lib/assistantUsage';
import { isMissingTable } from '@/lib/assistantMetrics';

export type AssistantQuota = {
  planTier: PlanTier;
  planName: string;
  limit: number;
  used: number;
  /** Contatos que já tiveram conversa hoje (continuam mesmo com a cota cheia). */
  leadsToday: Set<string>;
  alreadyBlockedThisMonth: boolean;
  monthStart: string;
};

export async function loadAssistantQuota(tenantId: string, now: Date = new Date()): Promise<AssistantQuota | null> {
  const monthStart = brtMonthStartIso(now);
  const [subRes, runsRes, blockedRes] = await Promise.all([
    supabaseAdmin.from('subscriptions').select('plan_tier').eq('tenant_id', tenantId).maybeSingle(),
    supabaseAdmin
      .from('assistant_runs')
      .select('lead_id, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'REPLIED')
      .gte('created_at', monthStart)
      .limit(20_000),
    supabaseAdmin
      .from('assistant_runs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('reason', 'COTA_ESGOTADA')
      .gte('created_at', monthStart),
  ]);
  if (isMissingTable(runsRes.error)) return null;
  if (runsRes.error) throw runsRes.error;

  const planTier = normalizePlanTier(subRes.data?.plan_tier);
  const runs = runsRes.data || [];
  const today = brtDate(now);
  return {
    planTier,
    planName: getPlanDisplayName(planTier),
    limit: getPlanAssistantConversationLimit(planTier),
    used: conversationKeys(runs).size,
    leadsToday: new Set(runs.filter((r) => r.lead_id && brtDate(r.created_at) === today).map((r) => r.lead_id as string)),
    alreadyBlockedThisMonth: (blockedRes.count ?? 0) > 0,
    monthStart,
  };
}
