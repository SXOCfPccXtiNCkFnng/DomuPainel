import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rateLimit';
import { generateWeeklyInsight, INSIGHTS_MIGRATION_PENDING, isMissingTable } from '@/lib/weeklyInsights';
import { getPlanDisplayName, planHasSalesIntelligence } from '@/lib/planLimits';

/** Dicas da semana e inteligência de vendas: Pro e Enterprise. */
async function planLocked(tenantId: string): Promise<NextResponse | null> {
  const { data } = await supabaseAdmin.from('subscriptions').select('plan_tier').eq('tenant_id', tenantId).maybeSingle();
  if (planHasSalesIntelligence(data?.plan_tier)) return null;
  return NextResponse.json({ success: true, locked: true, planName: getPlanDisplayName(data?.plan_tier), insight: null, weeks: [] });
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS = 'id, week_start, week_end, metrics, tips, ai_used, delivered_at, created_at';
/** "Gerar agora" de novo antes disso devolve o último resumo (a IA não roda à toa). */
const REGENERATE_AFTER_MS = 6 * 60 * 60 * 1000;

/** Dicas da semana: o resumo pedido (?id=) ou o mais recente, e a lista das semanas. Só administrador. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    const id = new URL(req.url).searchParams.get('id');
    const locked = await planLocked(tenantId);
    if (locked) return locked;

    const [listRes, oneRes] = await Promise.all([
      supabaseAdmin
        .from('weekly_insights')
        .select('id, week_start, week_end')
        .eq('tenant_id', tenantId)
        .order('week_start', { ascending: false })
        .limit(12),
      id && UUID_RE.test(id)
        ? supabaseAdmin.from('weekly_insights').select(COLUMNS).eq('tenant_id', tenantId).eq('id', id).maybeSingle()
        : supabaseAdmin
            .from('weekly_insights')
            .select(COLUMNS)
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);
    if (isMissingTable(listRes.error) || isMissingTable(oneRes.error)) {
      return NextResponse.json({ success: true, available: false, error: INSIGHTS_MIGRATION_PENDING, insight: null, weeks: [] });
    }
    if (listRes.error) throw listRes.error;
    if (oneRes.error) throw oneRes.error;
    return NextResponse.json({ success: true, available: true, insight: oneRes.data ?? null, weeks: listRes.data || [] });
  } catch (error) {
    return internalErrorResponse('insights.get', error);
  }
}

/** "Gerar agora": resumo dos últimos 7 dias, só no painel (não manda e-mail nem WhatsApp). */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const locked = await planLocked(tenantId);
    if (locked) return NextResponse.json({ success: false, locked: true, error: 'As dicas da semana são do plano Pro para cima.' }, { status: 403 });

    const limit = checkRateLimit(`insights:${tenantId}`, 3, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ success: false, error: 'Você já gerou as dicas há pouco. Tente de novo mais tarde.' }, { status: 429 });
    }

    const { data: last, error: lastError } = await supabaseAdmin
      .from('weekly_insights')
      .select(COLUMNS)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (isMissingTable(lastError)) return NextResponse.json({ success: false, error: INSIGHTS_MIGRATION_PENDING }, { status: 503 });
    if (last && Date.now() - new Date(last.created_at).getTime() < REGENERATE_AFTER_MS) {
      return NextResponse.json({ success: true, insight: last, reused: true });
    }

    const result = await generateWeeklyInsight(tenantId);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, insight: result.insight });
  } catch (error) {
    return internalErrorResponse('insights.generate', error);
  }
}
