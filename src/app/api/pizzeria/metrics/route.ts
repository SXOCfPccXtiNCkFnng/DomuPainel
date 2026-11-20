import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { computeOrderMetrics, improvementTips, LAPSED_MAX_DAYS, ordersAsSales } from '@/lib/pizzeria';
import { computeSalesIntelligence } from '@/lib/salesIntelligence';
import { loadMenu, loadOrdersSince } from '@/lib/pizzeriaServer';
import { countAssistantConversations, loadAssistantQuota } from '@/lib/assistantQuota';
import { countDispatchesSince, startOfUtcMonthIso } from '@/lib/dispatchUsage';
import { getPlanDisplayName, getPlanMonthlyLimit, getPlanUserLimit, normalizePlanTier, planHasSalesIntelligence } from '@/lib/planLimits';

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
    const intelligenceAllowed = planHasSalesIntelligence(tier);
    const startMs = now.getTime() - days * DAY_MS;
    const inPeriod = (o: { created_at: string }, from: number, to: number) => {
      const t = new Date(o.created_at).getTime();
      return t >= from && t < to;
    };
    const intelligence = intelligenceAllowed
      ? computeSalesIntelligence({
          sales: ordersAsSales(orders.filter((o) => inPeriod(o, startMs, now.getTime() + 1))),
          previous: ordersAsSales(orders.filter((o) => inPeriod(o, startMs - days * DAY_MS, startMs))),
          pairScope: 'pedido',
          unit: 'pedidos',
          campaignHref: '/disparos',
          catalogHref: '/cardapio',
          catalogLabel: 'cardápio',
        })
      : null;

    return NextResponse.json({
      success: true,
      days,
      metrics,
      // Inteligência de vendas (dicas, dia da semana, combos): Pro e Enterprise.
      intelligenceAllowed,
      tips: intelligenceAllowed ? improvementTips(metrics, { assistantEnabled, menuItems: activeMenu }) : [],
      intelligence,
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
