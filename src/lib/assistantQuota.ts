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
  /** O contato já teve conversa hoje (continua mesmo com a cota cheia). */
  continuingToday: boolean;
  alreadyBlockedThisMonth: boolean;
  monthStart: string;
};

/** O PostgREST devolve no máximo 1000 linhas por consulta. */
const PAGE_SIZE = 1000;
const FALLBACK_MAX_ROWS = 50_000;

function isMissingFunction(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST202' || error?.code === '42883';
}

/** Meia-noite de hoje em Brasília, em ISO UTC. */
function brtDayStartIso(now: Date): string {
  const [y, m, d] = brtDate(now).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + 3 * 60 * 60 * 1000).toISOString();
}

/**
 * Conversas (contato + dia) por conta desde `sinceIso`. Conta no banco; sem a
 * função (migration 20261020 pendente) lê as linhas em páginas de 1000.
 */
export async function countAssistantConversations(tenantIds: string[], sinceIso: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!tenantIds.length) return counts;

  const { data, error } = await supabaseAdmin.rpc('assistant_conversation_counts', {
    p_tenant_ids: tenantIds,
    p_since: sinceIso,
  });
  if (!error) {
    for (const row of (data || []) as { tenant_id: string; conversations: number | string }[]) {
      counts.set(row.tenant_id, Number(row.conversations) || 0);
    }
    return counts;
  }
  if (!isMissingFunction(error)) throw error;

  const byTenant = new Map<string, { lead_id: string | null; created_at: string }[]>();
  for (let from = 0; from < FALLBACK_MAX_ROWS; from += PAGE_SIZE) {
    const { data: page, error: pageError } = await supabaseAdmin
      .from('assistant_runs')
      .select('id, tenant_id, lead_id, created_at')
      .in('tenant_id', tenantIds)
      .eq('status', 'REPLIED')
      .gte('created_at', sinceIso)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (pageError) throw pageError;
    for (const r of page || []) {
      const list = byTenant.get(r.tenant_id) || [];
      list.push(r);
      byTenant.set(r.tenant_id, list);
    }
    if ((page || []).length < PAGE_SIZE) break;
  }
  for (const [tenantId, runs] of byTenant) counts.set(tenantId, conversationKeys(runs).size);
  return counts;
}

export async function loadAssistantQuota(
  tenantId: string,
  now: Date = new Date(),
  leadId?: string
): Promise<AssistantQuota | null> {
  const monthStart = brtMonthStartIso(now);
  const [subRes, blockedRes, todayRes] = await Promise.all([
    supabaseAdmin.from('subscriptions').select('plan_tier').eq('tenant_id', tenantId).maybeSingle(),
    supabaseAdmin
      .from('assistant_runs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('reason', 'COTA_ESGOTADA')
      .gte('created_at', monthStart),
    leadId
      ? supabaseAdmin
          .from('assistant_runs')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('lead_id', leadId)
          .eq('status', 'REPLIED')
          .gte('created_at', brtDayStartIso(now))
      : Promise.resolve({ count: 0, error: null }),
  ]);
  if (isMissingTable(blockedRes.error)) return null;
  if (blockedRes.error) throw blockedRes.error;

  const planTier = normalizePlanTier(subRes.data?.plan_tier);
  const counts = await countAssistantConversations([tenantId], monthStart);
  return {
    planTier,
    planName: getPlanDisplayName(planTier),
    limit: getPlanAssistantConversationLimit(planTier),
    used: counts.get(tenantId) ?? 0,
    continuingToday: (todayRes.count ?? 0) > 0,
    alreadyBlockedThisMonth: (blockedRes.count ?? 0) > 0,
    monthStart,
  };
}
