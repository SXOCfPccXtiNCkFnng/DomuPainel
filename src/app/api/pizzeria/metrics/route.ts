import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { computeOrderMetrics, improvementTips, LAPSED_MAX_DAYS } from '@/lib/pizzeria';
import { loadMenu, loadOrdersSince } from '@/lib/pizzeriaServer';
import { countAssistantConversations, loadAssistantQuota } from '@/lib/assistantQuota';
import { countDispatchesSince, startOfUtcMonthIso } from '@/lib/dispatchUsage';
import { getPlanDisplayName, getPlanMonthlyLimit, getPlanUserLimit, normalizePlanTier } from '@/lib/planLimits';

export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;
const PERIODS = [7, 30, 90];

/**
 * Vendas e métricas da pizzaria (?days=7|30|90): números do período, onde
 * melhorar, conversão da atendente e consumo do plano.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    const requested = Number(new URL(req.url).searchParams.get('days'));
    const days = PERIODS.includes(requested) ? requested : 30;
    const now = new Date();
    const since = new Date(now.getTime() - Math.max(days * 2, LAPSED_MAX_DAYS + 10) * DAY_MS);

    const [orders, menu, assistantRes, subRes, usersRes, quota, dispatches, conversations] = await Promise.all([
      loadOrdersSince(tenantId, since),
      loadMenu(tenantId),
      supabaseAdmin.from('assistant_settings').select('enabled').eq('tenant_id', tenantId).maybeSingle(),
      supabaseAdmin.from('subscriptions').select('plan_tier').eq('tenant_id', tenantId).maybeSingle(),
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      loadAssistantQuota(tenantId, now).catch(() => null),
      countDispatchesSince(tenantId, startOfUtcMonthIso()),
      countAssistantConversations([tenantId], new Date(now.getTime() - days * DAY_MS).toISOString()).catch(() => new Map<string, number>()),
    ]);

    const metrics = computeOrderMetrics(orders, now, days);
    const assistantEnabled = Boolean(assistantRes.data?.enabled);
    const activeMenu = menu.filter((m) => m.active).length;
    const tier = normalizePlanTier(subRes.data?.plan_tier);
    const periodConversations = conversations.get(tenantId) ?? 0;

    return NextResponse.json({
      success: true,
      days,
      metrics,
      tips: improvementTips(metrics, { assistantEnabled, menuItems: activeMenu }),
      assistant: {
        enabled: assistantEnabled,
        conversations: periodConversations,
        orders: metrics.byWhatsApp,
        // Quantas conversas da atendente viraram pedido no período.
        conversionRate: periodConversations ? Math.min(100, Math.round((metrics.byWhatsApp / periodConversations) * 100)) : null,
      },
      usage: {
        planName: getPlanDisplayName(tier),
        dispatches: { used: dispatches, limit: getPlanMonthlyLimit(tier) },
        conversations: quota ? { used: quota.used, limit: quota.limit } : null,
        users: { used: usersRes.count ?? 0, limit: getPlanUserLimit(tier) },
        menuItems: activeMenu,
      },
    });
  } catch (error: unknown) {
    return internalErrorResponse('api.pizzeria.metrics.get', error);
  }
}
